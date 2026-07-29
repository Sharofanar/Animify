export type CancelableAnimation = {
  cancel: () => void;
};

export type ManagedDeterministicAnimation<
  TDefinition,
  TAnimation extends CancelableAnimation,
> = {
  definition: TDefinition;
  animation: TAnimation;
};

/**
 * Reuse one deterministic animation until its compiled definition changes.
 *
 * Playback clocks call this on every sampled frame, so time-only updates must
 * never recreate the browser animation. Compiler output is immutable and
 * reference-stable between scene/Sequence definition changes.
 */
export function ensureDeterministicAnimation<
  TDefinition,
  TAnimation extends CancelableAnimation,
>(
  managedAnimations: Map<
    string,
    ManagedDeterministicAnimation<TDefinition, TAnimation>
  >,
  animationId: string,
  definition: TDefinition,
  createAnimation: () => TAnimation | undefined,
) {
  const existing = managedAnimations.get(animationId);

  if (existing?.definition === definition) {
    return existing.animation;
  }

  existing?.animation.cancel();

  const animation = createAnimation();

  if (!animation) {
    managedAnimations.delete(animationId);
    return undefined;
  }

  managedAnimations.set(animationId, {
    definition,
    animation,
  });

  return animation;
}

export function removeUnusedDeterministicAnimations<
  TDefinition,
  TAnimation extends CancelableAnimation,
>(
  managedAnimations: Map<
    string,
    ManagedDeterministicAnimation<TDefinition, TAnimation>
  >,
  visibleAnimationIds: ReadonlySet<string>,
) {
  managedAnimations.forEach((managedAnimation, animationId) => {
    if (visibleAnimationIds.has(animationId)) {
      return;
    }

    managedAnimation.animation.cancel();
    managedAnimations.delete(animationId);
  });
}

export function clearDeterministicAnimations<
  TDefinition,
  TAnimation extends CancelableAnimation,
>(
  managedAnimations: Map<
    string,
    ManagedDeterministicAnimation<TDefinition, TAnimation>
  >,
) {
  managedAnimations.forEach(({ animation }) => animation.cancel());
  managedAnimations.clear();
}
