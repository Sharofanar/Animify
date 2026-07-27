import type { Slide } from "../types/presentation";
import {
  compileAnimationSequence,
  type CompiledSlideAnimations,
} from "./animationCompiler";
import {
  createPresentationSlidePlaybackPlan,
  type PresentationSlidePlaybackPlan,
} from "./presentationPlayback";

export type ExportSlidePlaybackPlan = PresentationSlidePlaybackPlan & {
  sequenceOrder: string[];
  compiledBySequenceId: Record<string, CompiledSlideAnimations>;
};

/**
 * Build the serializable playback plan consumed by the standalone HTML player.
 *
 * Sequence order and duration come from the same presentation state-machine
 * plan used by the editor. Each Sequence is compiled independently so every
 * Clip delay remains relative to its owning Sequence's local 0ms.
 */
export function createExportSlidePlaybackPlan(
  slide: Pick<Slide, "id" | "animationScene">,
): ExportSlidePlaybackPlan {
  const playbackPlan = createPresentationSlidePlaybackPlan(slide);
  const sequenceOrder = [
    ...(playbackPlan.slideEnterSequenceId
      ? [playbackPlan.slideEnterSequenceId]
      : []),
    ...playbackPlan.clickStepSequenceIds,
  ];

  return {
    ...playbackPlan,
    sequenceOrder,
    compiledBySequenceId: Object.fromEntries(
      sequenceOrder.map((sequenceId) => [
        sequenceId,
        compileAnimationSequence(slide.animationScene, sequenceId),
      ]),
    ),
  };
}

export function createExportPlaybackPlans(slides: readonly Slide[]) {
  return Object.fromEntries(
    slides.map((slide) => [slide.id, createExportSlidePlaybackPlan(slide)]),
  );
}
