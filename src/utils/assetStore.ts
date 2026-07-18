const ASSET_DATABASE_NAME = "animify-assets";
const ASSET_DATABASE_VERSION = 1;
const ASSET_BLOB_STORE_NAME = "asset-blobs";

type AssetBlobRecord = {
  id: string;
  blob: Blob;
  updatedAt: string;
};

let assetDatabasePromise: Promise<IDBDatabase> | null = null;

/**
 * Convert one IndexedDB request into a normal Promise.
 */
function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed."));
    };
  });
}

/**
 * Wait until an IndexedDB transaction is fully committed.
 */
function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    };

    transaction.onabort = () => {
      reject(
        transaction.error ?? new Error("IndexedDB transaction was aborted."),
      );
    };
  });
}

/**
 * Open Animify's local binary asset database.
 *
 * The project JSON stores only asset metadata. Image, video, and audio binary
 * data live in this IndexedDB object store and are addressed by asset ID.
 */
function openAssetDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(
      new Error("This browser does not support IndexedDB."),
    );
  }

  if (assetDatabasePromise) {
    return assetDatabasePromise;
  }

  assetDatabasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(
      ASSET_DATABASE_NAME,
      ASSET_DATABASE_VERSION,
    );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(ASSET_BLOB_STORE_NAME)) {
        database.createObjectStore(ASSET_BLOB_STORE_NAME, {
          keyPath: "id",
        });
      }
    };

    request.onsuccess = () => {
      const database = request.result;

      database.onversionchange = () => {
        database.close();
        assetDatabasePromise = null;
      };

      resolve(database);
    };

    request.onerror = () => {
      assetDatabasePromise = null;

      reject(
        request.error ??
          new Error("Failed to open the Animify asset database."),
      );
    };
  });

  return assetDatabasePromise;
}

/**
 * Save or replace the Blob belonging to one project asset.
 */
export async function putAssetBlob(assetId: string, blob: Blob) {
  const database = await openAssetDatabase();

  const transaction = database.transaction(ASSET_BLOB_STORE_NAME, "readwrite");

  const completion = waitForTransaction(transaction);

  const request = transaction.objectStore(ASSET_BLOB_STORE_NAME).put({
    id: assetId,
    blob,
    updatedAt: new Date().toISOString(),
  } satisfies AssetBlobRecord);

  await requestToPromise(request);
  await completion;
}

/**
 * Read one asset Blob by its stable project asset ID.
 */
export async function getAssetBlob(assetId: string) {
  const database = await openAssetDatabase();

  const transaction = database.transaction(ASSET_BLOB_STORE_NAME, "readonly");

  const request = transaction
    .objectStore(ASSET_BLOB_STORE_NAME)
    .get(assetId) as IDBRequest<AssetBlobRecord | undefined>;

  const record = await requestToPromise(request);

  return record?.blob;
}

/**
 * Delete one binary asset from IndexedDB.
 *
 * This is used to roll back a failed import batch before any project metadata
 * starts referencing the incomplete resource.
 */
export async function deleteAssetBlob(
  assetId: string,
) {
  const database =
    await openAssetDatabase();

  const transaction = database.transaction(
    ASSET_BLOB_STORE_NAME,
    "readwrite",
  );

  const completion =
    waitForTransaction(transaction);

  const request = transaction
    .objectStore(ASSET_BLOB_STORE_NAME)
    .delete(assetId);

  await requestToPromise(request);
  await completion;
}

/**
 * Persist one Blob and immediately read it back for verification.
 *
 * Project metadata must never reference an asset until this function succeeds.
 */
export async function putVerifiedAssetBlob(
  assetId: string,
  blob: Blob,
) {
  if (!assetId.trim()) {
    throw new Error(
      "Asset ID cannot be empty.",
    );
  }

  if (blob.size <= 0) {
    throw new Error(
      `Asset Blob is empty: ${assetId}`,
    );
  }

  await putAssetBlob(assetId, blob);

  const storedBlob =
    await getAssetBlob(assetId);

  const sizeMatches =
    storedBlob?.size === blob.size;

  const typeMatches =
    !blob.type ||
    storedBlob?.type === blob.type;

  if (
    !storedBlob ||
    !sizeMatches ||
    !typeMatches
  ) {
    /**
     * Never leave a failed verification record behind. A later resource scan
     * should therefore see either one valid Blob or no Blob at all.
     */
    await deleteAssetBlob(assetId);

    throw new Error(
      `Asset Blob verification failed: ${assetId}`,
    );
  }

  return storedBlob;
}

/**
 * Convert one legacy Data URL into a Blob for IndexedDB migration.
 */
export async function dataUrlToBlob(source: string) {
  const response = await fetch(source);

  if (!response.ok) {
    throw new Error("Failed to convert the legacy asset source.");
  }

  return response.blob();
}

/**
 * Convert a Blob into a portable Data URL.
 *
 * Runtime preview uses Blob URLs, while standalone HTML export needs Data URLs
 * because Blob URLs belong only to the current browser session.
 */
export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to convert Blob to Data URL."));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read asset Blob."));
    };

    reader.readAsDataURL(blob);
  });
}
