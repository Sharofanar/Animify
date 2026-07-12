import type { Slide, SlideElement } from "../types/presentation";
import { createAnimationSceneFromLegacyElements } from "./animationSchema";

export type AnimationCommandElementUpdates = Partial<
  Omit<SlideElement, "style">
> & {
  style?: Partial<SlideElement["style"]>;
};

export type AnimationCommandBatchUpdate = {
  elementId: string;
  updates: AnimationCommandElementUpdates;
};

/**
 * Apply a batch of element updates to one slide.
 *
 * During the migration period, animation edits still update the legacy
 * element.animations structure. Whenever that structure changes, this command
 * immediately rebuilds the slide-level Animation Schema V2 scene so the two
 * representations cannot drift apart.
 */
export function applyElementBatchUpdatesToSlide(
  slide: Slide,
  batchUpdates: AnimationCommandBatchUpdate[],
): Slide {
  if (batchUpdates.length === 0) {
    return slide;
  }

  const updatesByElementId = new Map(
    batchUpdates.map((item) => [item.elementId, item.updates]),
  );

  let changed = false;
  let animationDataChanged = false;

  const nextElements = slide.elements.map((element) => {
    const updates = updatesByElementId.get(element.id);

    if (!updates) {
      return element;
    }

    changed = true;

    /**
     * An empty animations array still counts as an animation edit, so check for
     * the property itself instead of checking whether its value is truthy.
     */
    if (Object.prototype.hasOwnProperty.call(updates, "animations")) {
      animationDataChanged = true;
    }

    return {
      ...element,
      ...updates,
      style: updates.style
        ? {
            ...element.style,
            ...updates.style,
          }
        : element.style,
    };
  });

  if (!changed) {
    return slide;
  }

  if (!animationDataChanged) {
    return {
      ...slide,
      elements: nextElements,
    };
  }

  const rebuiltAnimationScene = createAnimationSceneFromLegacyElements(
    slide.id,
    nextElements,
  );

  return {
    ...slide,
    elements: nextElements,
    animationScene: {
      ...rebuiltAnimationScene,

      /**
       * Revision changes invalidate future compiled-animation caches.
       * A legacy project without a revision starts from revision 1.
       */
      revision: Math.max(1, (slide.animationScene?.revision ?? 0) + 1),
    },
  };
}
