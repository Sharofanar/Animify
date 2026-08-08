import type {
  PresentationProject,
  SlideElement,
} from "../types/presentation";
import type {
  ElementBatchUpdate,
  ElementUpdates,
} from "../types/editor";
import {
  applyElementBatchUpdatesToSlide,
  deleteSlideElementsWithAnimations,
} from "./animationLegacyCompatibility";

export type ElementPatch = ElementUpdates;
export type ElementBatchPatch = ElementBatchUpdate;

export type ElementLayerAction =
  | "bring-forward"
  | "send-backward"
  | "bring-to-front"
  | "send-to-back";

export type ElementCommandResult = {
  project: PresentationProject;
  affectedElementIds: string[];
};

export type InsertElementsCommandResult = ElementCommandResult & {
  insertedElementIds: string[];
};

export type InsertElementsCommand = {
  slideId: string;
  elements: SlideElement[];
  updatedAt: string;
  index?: number;
};

export type UpdateElementsCommand = {
  slideId: string;
  updates: ElementBatchPatch[];
  updatedAt: string;
};

export type UpdateElementCommand = {
  slideId: string;
  elementId: string;
  updates: ElementPatch;
  updatedAt: string;
};

export type ReorderElementsCommand = {
  slideId: string;
  elementIds: string[];
  action: ElementLayerAction;
  updatedAt: string;
};

export type DeleteElementsCommand = {
  slideId: string;
  elementIds: string[];
  updatedAt: string;
};

function unchangedResult(project: PresentationProject): ElementCommandResult {
  return {
    project,
    affectedElementIds: [],
  };
}

function replaceProjectSlide(
  project: PresentationProject,
  slideId: string,
  nextSlide: PresentationProject["slides"][number],
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

function doesElementPatchChange(
  element: SlideElement,
  updates: ElementPatch,
): boolean {
  const { style, ...topLevelUpdates } = updates;

  for (const [key, value] of Object.entries(topLevelUpdates)) {
    if (!Object.is((element as Record<string, unknown>)[key], value)) {
      return true;
    }
  }

  if (!style) {
    return false;
  }

  return Object.entries(style).some(
    ([key, value]) =>
      !Object.is((element.style as Record<string, unknown>)[key], value),
  );
}

/**
 * Insert elements already constructed by the caller without taking ownership of
 * IDs, assets, History, or Selection.
 */
export function insertElementsInProject(
  project: PresentationProject,
  command: InsertElementsCommand,
): InsertElementsCommandResult {
  const slide = project.slides.find((item) => item.id === command.slideId);

  if (!slide || command.elements.length === 0) {
    return {
      ...unchangedResult(project),
      insertedElementIds: [],
    };
  }

  const insertIndex = Math.max(
    0,
    Math.min(command.index ?? slide.elements.length, slide.elements.length),
  );
  const nextSlide = {
    ...slide,
    elements: [
      ...slide.elements.slice(0, insertIndex),
      ...command.elements,
      ...slide.elements.slice(insertIndex),
    ],
  };
  const insertedElementIds = command.elements.map((element) => element.id);

  return {
    project: replaceProjectSlide(
      project,
      command.slideId,
      nextSlide,
      command.updatedAt,
    ),
    affectedElementIds: insertedElementIds,
    insertedElementIds,
  };
}

/**
 * Apply exact element patches while delegating legacy/V2 synchronization to
 * the lower-level compatibility domain. History and Selection remain here.
 */
export function updateElementsInProject(
  project: PresentationProject,
  command: UpdateElementsCommand,
): ElementCommandResult {
  const slide = project.slides.find((item) => item.id === command.slideId);

  if (!slide || command.updates.length === 0) {
    return unchangedResult(project);
  }

  const updatesByElementId = new Map(
    command.updates.map((item) => [item.elementId, item.updates]),
  );
  const effectiveUpdates: ElementBatchPatch[] = [];

  for (const element of slide.elements) {
    const updates = updatesByElementId.get(element.id);

    if (updates && doesElementPatchChange(element, updates)) {
      effectiveUpdates.push({
        elementId: element.id,
        updates,
      });
    }
  }

  if (effectiveUpdates.length === 0) {
    return unchangedResult(project);
  }

  const nextSlide = applyElementBatchUpdatesToSlide(slide, effectiveUpdates);

  if (nextSlide === slide) {
    return unchangedResult(project);
  }

  return {
    project: replaceProjectSlide(
      project,
      command.slideId,
      nextSlide,
      command.updatedAt,
    ),
    affectedElementIds: effectiveUpdates.map((item) => item.elementId),
  };
}

export function updateElementInProject(
  project: PresentationProject,
  command: UpdateElementCommand,
): ElementCommandResult {
  return updateElementsInProject(project, {
    slideId: command.slideId,
    updates: [
      {
        elementId: command.elementId,
        updates: command.updates,
      },
    ],
    updatedAt: command.updatedAt,
  });
}

/**
 * Reorder elements by array position because later entries render above earlier
 * entries. Selected elements retain their internal relative order.
 */
export function reorderElementsInProject(
  project: PresentationProject,
  command: ReorderElementsCommand,
): ElementCommandResult {
  const slide = project.slides.find((item) => item.id === command.slideId);
  const targetElementIdSet = new Set(command.elementIds);

  if (!slide || targetElementIdSet.size === 0) {
    return unchangedResult(project);
  }

  let nextElements = [...slide.elements];

  if (command.action === "bring-forward") {
    for (let index = nextElements.length - 2; index >= 0; index -= 1) {
      const currentElement = nextElements[index];
      const upperElement = nextElements[index + 1];

      if (
        currentElement &&
        upperElement &&
        targetElementIdSet.has(currentElement.id) &&
        !targetElementIdSet.has(upperElement.id)
      ) {
        nextElements[index] = upperElement;
        nextElements[index + 1] = currentElement;
      }
    }
  }

  if (command.action === "send-backward") {
    for (let index = 1; index < nextElements.length; index += 1) {
      const currentElement = nextElements[index];
      const lowerElement = nextElements[index - 1];

      if (
        currentElement &&
        lowerElement &&
        targetElementIdSet.has(currentElement.id) &&
        !targetElementIdSet.has(lowerElement.id)
      ) {
        nextElements[index] = lowerElement;
        nextElements[index - 1] = currentElement;
      }
    }
  }

  if (command.action === "bring-to-front") {
    const unselectedElements = nextElements.filter(
      (element) => !targetElementIdSet.has(element.id),
    );
    const selectedElements = nextElements.filter((element) =>
      targetElementIdSet.has(element.id),
    );

    nextElements = [...unselectedElements, ...selectedElements];
  }

  if (command.action === "send-to-back") {
    const selectedElements = nextElements.filter((element) =>
      targetElementIdSet.has(element.id),
    );
    const unselectedElements = nextElements.filter(
      (element) => !targetElementIdSet.has(element.id),
    );

    nextElements = [...selectedElements, ...unselectedElements];
  }

  const changedElementIds = slide.elements.flatMap((element, index) =>
    targetElementIdSet.has(element.id) &&
    element.id !== nextElements[index]?.id
      ? [element.id]
      : [],
  );

  if (changedElementIds.length === 0) {
    return unchangedResult(project);
  }

  const nextSlide = {
    ...slide,
    elements: nextElements,
  };

  return {
    project: replaceProjectSlide(
      project,
      command.slideId,
      nextSlide,
      command.updatedAt,
    ),
    affectedElementIds: changedElementIds,
  };
}

/**
 * Deletion must use the complete animation cleanup transaction so no Clip,
 * Sequence, or trigger keeps an invalid element reference.
 */
export function deleteElementsInProject(
  project: PresentationProject,
  command: DeleteElementsCommand,
): ElementCommandResult {
  const slide = project.slides.find((item) => item.id === command.slideId);
  const requestedElementIdSet = new Set(command.elementIds);

  if (!slide || requestedElementIdSet.size === 0) {
    return unchangedResult(project);
  }

  const deletedElementIds = slide.elements.flatMap((element) =>
    requestedElementIdSet.has(element.id) ? [element.id] : [],
  );

  if (deletedElementIds.length === 0) {
    return unchangedResult(project);
  }

  const nextSlide = deleteSlideElementsWithAnimations(slide, deletedElementIds);

  if (nextSlide === slide) {
    return unchangedResult(project);
  }

  return {
    project: replaceProjectSlide(
      project,
      command.slideId,
      nextSlide,
      command.updatedAt,
    ),
    affectedElementIds: deletedElementIds,
  };
}
