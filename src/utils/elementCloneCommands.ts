import type {
  AnimationScene,
  PresentationProject,
  Slide,
  SlideElement,
} from "../types/presentation";
import { cloneElementAnimationsForInsertedElements } from "./animationElementClone";

export type ElementCopySnapshot = {
  sourceSlideId: string;
  elements: SlideElement[];
  animationScene: AnimationScene;
};

export type ElementPastePlacement =
  | {
      type: "offset";
      deltaX: number;
      deltaY: number;
    }
  | {
      type: "slide-anchor";
      x: number;
      y: number;
    };

export type CreateElementCopySnapshotCommand = {
  slideId: string;
  elementIds: string[];
};

export type PasteElementSnapshotCommand = {
  targetSlideId: string;
  snapshot: ElementCopySnapshot;
  placement: ElementPastePlacement;
  operationId: string;
  updatedAt: string;
};

export type PasteElementSnapshotResult = {
  project: PresentationProject;
  insertedElementIds: string[];
};

export type DuplicateElementCommand = {
  slideId: string;
  elementId: string;
  operationId: string;
  updatedAt: string;
};

export type DuplicateElementResult = {
  project: PresentationProject;
  duplicatedElementId?: string;
};

/**
 * Clipboard data must be isolated from later Project edits. Persistent element
 * and animation data is JSON-shaped, so one recursive copier covers every
 * nested mutable record without taking ownership of Asset Blob storage.
 */
function clonePersistentValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clonePersistentValue(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        clonePersistentValue(item),
      ]),
    ) as T;
  }

  return value;
}

function createUniqueId(preferredId: string, usedIds: Set<string>) {
  let nextId = preferredId;
  let suffix = 1;

  while (usedIds.has(nextId)) {
    nextId = `${preferredId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(nextId);
  return nextId;
}

function collectElementIds(project: PresentationProject) {
  return new Set(
    project.slides.flatMap((slide) =>
      slide.elements.map((element) => element.id),
    ),
  );
}

function collectLegacyAnimationIds(project: PresentationProject) {
  return new Set(
    project.slides.flatMap((slide) =>
      slide.elements.flatMap((element) =>
        element.animations.map((animation) => animation.id),
      ),
    ),
  );
}

function replaceProjectSlide(
  project: PresentationProject,
  slideId: string,
  nextSlide: Slide,
  updatedAt: string,
): PresentationProject {
  return {
    ...project,
    updatedAt,
    slides: project.slides.map((slide) =>
      slide.id === slideId ? nextSlide : slide,
    ),
  };
}

function getPastePosition(
  sourceElement: SlideElement,
  placement: ElementPastePlacement,
  sourceLeft: number,
  sourceTop: number,
) {
  if (placement.type === "offset") {
    return {
      x: sourceElement.style.x + placement.deltaX,
      y: sourceElement.style.y + placement.deltaY,
    };
  }

  // Viewport-to-slide conversion stays in App; this command only applies the
  // already-resolved slide-space anchor to the copied group.
  return {
    x: placement.x + (sourceElement.style.x - sourceLeft),
    y: placement.y + (sourceElement.style.y - sourceTop),
  };
}

function cloneElementForInsert(
  sourceElement: SlideElement,
  elementId: string,
  nameSuffix: string,
  position: { x: number; y: number },
  operationId: string,
  elementIndex: number,
  usedLegacyAnimationIds: Set<string>,
): SlideElement {
  const clonedElement = clonePersistentValue(sourceElement);

  return {
    ...clonedElement,
    id: elementId,
    name: `${sourceElement.name} ${nameSuffix}`,
    style: {
      ...clonedElement.style,
      ...position,
    },
    animations: clonedElement.animations.map((animation, animationIndex) => ({
      ...animation,
      id: createUniqueId(
        `${animation.id}-${operationId}-${elementIndex}-${animationIndex}`,
        usedLegacyAnimationIds,
      ),
    })),
  };
}

/**
 * Capture selected elements in document layer order without mutating Project or
 * generating insertion IDs.
 */
export function createElementCopySnapshot(
  project: PresentationProject,
  command: CreateElementCopySnapshotCommand,
): ElementCopySnapshot | null {
  const slide = project.slides.find((item) => item.id === command.slideId);
  const requestedElementIds = new Set(command.elementIds);

  if (!slide || requestedElementIds.size === 0) {
    return null;
  }

  const elements = slide.elements.filter((element) =>
    requestedElementIds.has(element.id),
  );

  if (elements.length === 0) {
    return null;
  }

  return {
    sourceSlideId: slide.id,
    elements: clonePersistentValue(elements),
    animationScene: clonePersistentValue(slide.animationScene),
  };
}

/**
 * Clone commands own only deterministic Project transforms. App remains the
 * owner of History transactions, clipboard state, Selection, and UI effects.
 */
export function pasteElementSnapshotInProject(
  project: PresentationProject,
  command: PasteElementSnapshotCommand,
): PasteElementSnapshotResult {
  const targetSlide = project.slides.find(
    (slide) => slide.id === command.targetSlideId,
  );

  if (!targetSlide || command.snapshot.elements.length === 0) {
    return {
      project,
      insertedElementIds: [],
    };
  }

  const usedElementIds = collectElementIds(project);
  const usedLegacyAnimationIds = collectLegacyAnimationIds(project);
  const sourceLeft = Math.min(
    ...command.snapshot.elements.map((element) => element.style.x),
  );
  const sourceTop = Math.min(
    ...command.snapshot.elements.map((element) => element.style.y),
  );
  const insertedElements = command.snapshot.elements.map(
    (sourceElement, elementIndex) => {
      // operationId is supplied by App so fixed command inputs remain
      // deterministic even when a prior operation already used the same ID.
      const elementId = createUniqueId(
        `${sourceElement.id}-${command.operationId}-${elementIndex}`,
        usedElementIds,
      );

      return cloneElementForInsert(
        sourceElement,
        elementId,
        "粘贴",
        getPastePosition(
          sourceElement,
          command.placement,
          sourceLeft,
          sourceTop,
        ),
        command.operationId,
        elementIndex,
        usedLegacyAnimationIds,
      );
    },
  );
  const nextSlideWithElements = {
    ...targetSlide,
    elements: [...targetSlide.elements, ...insertedElements],
  };

  // V2 Clip/Sequence/Track/Keyframe cloning stays authoritative in the
  // dedicated animation kernel; this Facade only prepares element ownership.
  const nextSlide = cloneElementAnimationsForInsertedElements({
    targetSlide: nextSlideWithElements,
    sourceScene: command.snapshot.animationScene,
    sourceSlideId: command.snapshot.sourceSlideId,
    sourceElements: command.snapshot.elements,
    insertedElements,
    operationId: command.operationId,
  });
  const insertedElementIds = insertedElements.map((element) => element.id);

  return {
    project: replaceProjectSlide(
      project,
      targetSlide.id,
      nextSlide,
      command.updatedAt,
    ),
    insertedElementIds,
  };
}

export function duplicateElementInProject(
  project: PresentationProject,
  command: DuplicateElementCommand,
): DuplicateElementResult {
  const slide = project.slides.find((item) => item.id === command.slideId);
  const sourceElementIndex =
    slide?.elements.findIndex((element) => element.id === command.elementId) ??
    -1;
  const sourceElement =
    sourceElementIndex >= 0 ? slide?.elements[sourceElementIndex] : undefined;

  if (!slide || !sourceElement) {
    return { project };
  }

  const usedElementIds = collectElementIds(project);
  const usedLegacyAnimationIds = collectLegacyAnimationIds(project);
  const duplicatedElementId = createUniqueId(
    `${sourceElement.id}-${command.operationId}`,
    usedElementIds,
  );
  const duplicatedElement = cloneElementForInsert(
    sourceElement,
    duplicatedElementId,
    "副本",
    {
      x: sourceElement.style.x + 32,
      y: sourceElement.style.y + 32,
    },
    command.operationId,
    0,
    usedLegacyAnimationIds,
  );
  const nextSlideWithElement = {
    ...slide,
    elements: [
      ...slide.elements.slice(0, sourceElementIndex + 1),
      duplicatedElement,
      ...slide.elements.slice(sourceElementIndex + 1),
    ],
  };
  const nextSlide = cloneElementAnimationsForInsertedElements({
    targetSlide: nextSlideWithElement,
    sourceScene: slide.animationScene,
    sourceSlideId: slide.id,
    sourceElements: [sourceElement],
    insertedElements: [duplicatedElement],
    operationId: command.operationId,
  });

  return {
    project: replaceProjectSlide(
      project,
      slide.id,
      nextSlide,
      command.updatedAt,
    ),
    duplicatedElementId,
  };
}
