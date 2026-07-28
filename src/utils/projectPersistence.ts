import { demoProject } from "../data/demoProject";
import type {
  PresentationAsset,
  PresentationProject,
} from "../types/presentation";
import { normalizeProjectAnimationScenes } from "./animationSchema";
import { normalizeSlideTitles } from "./slideOperations";

const PROJECT_STORAGE_KEY = "animify-project";

type LegacyPersistedAsset = PresentationAsset & {
  source?: string;
};

type LegacyPersistedProject = Omit<PresentationProject, "assets"> & {
  assets?: Record<string, LegacyPersistedAsset>;
};

export type LegacyPersistedAssetSource = {
  assetId: string;
  source: string;
};

export type PersistedProjectLoadResult = {
  project: PresentationProject;
  legacyAssetSources: LegacyPersistedAssetSource[];
};

/**
 * Browser JSON boundary for presentation projects.
 *
 * React state, history transactions, and the IndexedDB Blob lifecycle remain
 * caller-owned. Legacy Data URLs are returned as migration input so the caller
 * can finish Blob migration before enabling autosave.
 */
export function loadPersistedProject(): PersistedProjectLoadResult {
  const savedProject = localStorage.getItem(PROJECT_STORAGE_KEY);

  if (!savedProject) {
    return {
      project: normalizeProjectAnimationScenes(demoProject),
      legacyAssetSources: [],
    };
  }

  try {
    const parsedProject = JSON.parse(savedProject) as LegacyPersistedProject;
    const normalizedAssets: Record<string, PresentationAsset> = {};
    const legacyAssetSources: LegacyPersistedAssetSource[] = [];

    for (const [assetId, legacyAsset] of Object.entries(
      parsedProject.assets ?? {},
    )) {
      const { source, ...assetMetadata } = legacyAsset;

      if (typeof source === "string" && source.length > 0) {
        legacyAssetSources.push({
          assetId,
          source,
        });
      }

      normalizedAssets[assetId] = {
        ...assetMetadata,
        id: assetMetadata.id || assetId,
      };
    }

    const normalizedProject: PresentationProject = {
      ...parsedProject,
      assets: normalizedAssets,
      slides: normalizeSlideTitles(parsedProject.slides),
    };

    return {
      project: normalizeProjectAnimationScenes(normalizedProject),
      legacyAssetSources,
    };
  } catch {
    return {
      project: normalizeProjectAnimationScenes(demoProject),
      legacyAssetSources: [],
    };
  }
}

/**
 * Callers must keep their existing readiness gates before saving; this adapter
 * intentionally has no knowledge of asset migration or editor state.
 */
export function savePersistedProject(project: PresentationProject) {
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
}

export function clearPersistedProject() {
  localStorage.removeItem(PROJECT_STORAGE_KEY);
}
