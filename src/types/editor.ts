import type { SlideElement } from "./presentation";

export type AnimationWorkspaceDisplayMode = "on-demand" | "always";

export type ElementUpdates = Partial<Omit<SlideElement, "style">> & {
  style?: Partial<SlideElement["style"]>;
};

export type ElementBatchUpdate = {
  elementId: string;
  updates: ElementUpdates;
};

export type ActiveAnimationContext = {
  elementId: string;
  clipId: string;

  /**
   * Increment when an outside editor requests the same Clip again.
   *
   * The ID allows the track inspector to reopen and scroll to an already
   * selected Clip without duplicating any animation data in UI state.
   */
  requestId: number;
};

export type TimelinePlaybackStatus = "idle" | "playing" | "paused";
