import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type {
  AnimationTimelineKeyframeSelection,
  AnimationTimelineSelection,
} from "../../utils/animationTimeline";

export type AnimationTimelineBoxRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type AnimationTimelineBoxKeyframeIdentity = {
  trackId: string;
  keyframeId: string;
};

export type AnimationTimelineBoxScope = {
  sequenceGroupId: string;
  sequenceId?: string;
  clipId: string;
  selectionElementId: string;
};

export type AnimationTimelineBoxSelectionPreview = {
  scopeClipId: string;
  overlayRect: AnimationTimelineBoxRect;
  selectedKeyframes: AnimationTimelineBoxKeyframeIdentity[];
  primary?: AnimationTimelineBoxKeyframeIdentity;
};

export type AnimationTimelineBoxBackgroundRequest = {
  scope?: AnimationTimelineBoxScope;
  boxAllowed: boolean;
  multiSelectMode: boolean;
  playheadX: number;
  playheadHitRadiusPx: number;
};

export type AnimationTimelineBoxMarkerRegistration = {
  clipId: string;
  sequenceId?: string;
  trackId: string;
  keyframeId: string;
  trackOrder: number;
  keyframeOrder: number;
  editable: boolean;
  node: HTMLButtonElement | null;
};

export type AnimationTimelineBoxHitCandidate = {
  clipId: string;
  sequenceId?: string;
  trackId: string;
  keyframeId: string;
  trackOrder: number;
  keyframeOrder: number;
  editable: boolean;
  visible: boolean;
  rect: AnimationTimelineBoxRect;
};

type RegisteredAnimationTimelineBoxMarker = Omit<
  AnimationTimelineBoxMarkerRegistration,
  "node"
> & {
  node: HTMLButtonElement;
};

type AnimationTimelineBoxPointerSession = {
  pointerId: number;
  background: HTMLDivElement;
  scope?: AnimationTimelineBoxScope;
  sourceSelection?: AnimationTimelineSelection;
  sourceClientX: number;
  sourceClientY: number;
  currentClientX: number;
  currentClientY: number;
  sourceLocalX: number;
  sourceLocalY: number;
  sourceScrollLeft: number;
  sourceScrollTop: number;
  boxActivationRequested: boolean;
  active: boolean;
  movementExceededThreshold: boolean;
  finished: boolean;
};

type UseAnimationTimelineBoxSelectionOptions = {
  contextKey: string;
  contextVersion: unknown;
  selection?: AnimationTimelineSelection;
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  dragThresholdPx: number;
  viewportLeftInsetPx: number;
  viewportTopInsetPx: number;
  onEmptyTimelineClick: () => void;
  onCommitBoxSelection: (
    scope: AnimationTimelineBoxScope,
    selection: AnimationTimelineKeyframeSelection | null,
  ) => void;
};

function getIdentityKey(identity: AnimationTimelineBoxKeyframeIdentity) {
  return `${identity.trackId}\u0000${identity.keyframeId}`;
}

function toBoxRect(rect: DOMRect): AnimationTimelineBoxRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}

export function getAnimationTimelineBoxRect(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
): AnimationTimelineBoxRect {
  return {
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    right: Math.max(startX, currentX),
    bottom: Math.max(startY, currentY),
  };
}

export function animationTimelineBoxRectsIntersect(
  left: AnimationTimelineBoxRect,
  right: AnimationTimelineBoxRect,
) {
  return (
    left.left < right.right &&
    left.right > right.left &&
    left.top < right.bottom &&
    left.bottom > right.top
  );
}

export function shouldActivateAnimationTimelineBoxSelection({
  boxAllowed,
  multiSelectMode,
  pointerType,
  shiftKey,
  ctrlKey,
  metaKey,
  altKey,
}: {
  boxAllowed: boolean;
  multiSelectMode: boolean;
  pointerType: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}) {
  if (!boxAllowed || ctrlKey || metaKey || altKey) {
    return false;
  }

  return multiSelectMode || (pointerType !== "touch" && shiftKey);
}

export function shouldCommitAnimationTimelineEmptyBackgroundClick({
  movementExceededThreshold,
  pointerUpOnBackground,
  ctrlKey,
  metaKey,
  shiftKey,
  altKey,
  playheadHit,
}: {
  movementExceededThreshold: boolean;
  pointerUpOnBackground: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  playheadHit: boolean;
}) {
  return (
    !movementExceededThreshold &&
    pointerUpOnBackground &&
    !ctrlKey &&
    !metaKey &&
    !shiftKey &&
    !altKey &&
    !playheadHit
  );
}

export function getAnimationTimelineBoxHitIdentities({
  scope,
  selectionRect,
  candidates,
}: {
  scope: Pick<AnimationTimelineBoxScope, "clipId" | "sequenceId">;
  selectionRect: AnimationTimelineBoxRect;
  candidates: AnimationTimelineBoxHitCandidate[];
}) {
  return candidates
    .filter(
      (candidate) =>
        candidate.clipId === scope.clipId &&
        candidate.sequenceId === scope.sequenceId &&
        candidate.editable &&
        candidate.visible &&
        animationTimelineBoxRectsIntersect(candidate.rect, selectionRect),
    )
    .sort(
      (left, right) =>
        left.trackOrder - right.trackOrder ||
        left.keyframeOrder - right.keyframeOrder ||
        left.trackId.localeCompare(right.trackId) ||
        left.keyframeId.localeCompare(right.keyframeId),
    )
    .map(({ trackId, keyframeId }) => ({ trackId, keyframeId }));
}

export function getAnimationTimelineBoxSelectionResult({
  scope,
  orderedHits,
  sourceSelection,
}: {
  scope: AnimationTimelineBoxScope;
  orderedHits: AnimationTimelineBoxKeyframeIdentity[];
  sourceSelection?: AnimationTimelineSelection;
}): AnimationTimelineKeyframeSelection | null {
  if (orderedHits.length === 0) {
    return null;
  }

  const hitKeys = new Set(orderedHits.map(getIdentityKey));
  const sourcePrimary =
    sourceSelection?.kind === "keyframe" &&
    sourceSelection.clipId === scope.clipId &&
    hitKeys.has(getIdentityKey(sourceSelection.primary))
      ? sourceSelection.primary
      : undefined;

  return {
    kind: "keyframe",
    sequenceGroupId: scope.sequenceGroupId,
    sequenceId: scope.sequenceId,
    clipId: scope.clipId,
    primary: sourcePrimary ?? orderedHits[0],
    selectedKeyframes: orderedHits,
  };
}

export function useAnimationTimelineBoxSelection({
  contextKey,
  contextVersion,
  selection,
  scrollViewportRef,
  dragThresholdPx,
  viewportLeftInsetPx,
  viewportTopInsetPx,
  onEmptyTimelineClick,
  onCommitBoxSelection,
}: UseAnimationTimelineBoxSelectionOptions) {
  const [preview, setPreview] =
    useState<AnimationTimelineBoxSelectionPreview | null>(null);
  const markersRef = useRef(
    new Map<string, RegisteredAnimationTimelineBoxMarker>(),
  );
  const cancelSessionRef = useRef<(() => void) | null>(null);
  const latestCallbacksRef = useRef({
    onEmptyTimelineClick,
    onCommitBoxSelection,
  });

  useEffect(() => {
    latestCallbacksRef.current = {
      onEmptyTimelineClick,
      onCommitBoxSelection,
    };
  }, [onCommitBoxSelection, onEmptyTimelineClick]);

  const registerMarker = useCallback(
    ({ node, ...registration }: AnimationTimelineBoxMarkerRegistration) => {
      const key = `${registration.clipId}\u0000${registration.trackId}\u0000${registration.keyframeId}`;

      if (node) {
        markersRef.current.set(key, { ...registration, node });
      } else {
        markersRef.current.delete(key);
      }
    },
    [],
  );

  const getVisibleHits = useCallback(
    (
      scope: Pick<AnimationTimelineBoxScope, "clipId" | "sequenceId">,
      clientRect: AnimationTimelineBoxRect,
    ): AnimationTimelineBoxKeyframeIdentity[] => {
      const viewport = scrollViewportRef.current;

      if (!viewport) {
        return [];
      }

      const viewportRect = viewport.getBoundingClientRect();
      const visibleTimeViewport: AnimationTimelineBoxRect = {
        left: viewportRect.left + viewportLeftInsetPx,
        top: viewportRect.top + viewportTopInsetPx,
        right: viewportRect.right,
        bottom: viewportRect.bottom,
      };

      return getAnimationTimelineBoxHitIdentities({
        scope,
        selectionRect: clientRect,
        candidates: [...markersRef.current.values()].map((marker) => {
          const markerRect = toBoxRect(marker.node.getBoundingClientRect());

          return {
            ...marker,
            rect: markerRect,
            visible:
              marker.node.isConnected &&
              animationTimelineBoxRectsIntersect(
                markerRect,
                visibleTimeViewport,
              ),
          };
        }),
      });
    },
    [scrollViewportRef, viewportLeftInsetPx, viewportTopInsetPx],
  );

  const handleBackgroundPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLDivElement>,
      request: AnimationTimelineBoxBackgroundRequest,
    ) => {
      if (
        event.button !== 0 ||
        !event.isPrimary ||
        event.target !== event.currentTarget ||
        event.altKey
      ) {
        return;
      }

      const viewport = scrollViewportRef.current;

      if (!viewport) {
        return;
      }

      const background = event.currentTarget;
      const backgroundRect = background.getBoundingClientRect();
      const sourcePlayheadHit =
        Math.abs(event.clientX - backgroundRect.left - request.playheadX) <=
        request.playheadHitRadiusPx;

      if (sourcePlayheadHit) {
        return;
      }

      cancelSessionRef.current?.();

      const viewportRect = viewport.getBoundingClientRect();
      const session: AnimationTimelineBoxPointerSession = {
        pointerId: event.pointerId,
        background,
        scope: request.scope,
        sourceSelection: selection,
        sourceClientX: event.clientX,
        sourceClientY: event.clientY,
        currentClientX: event.clientX,
        currentClientY: event.clientY,
        sourceLocalX: event.clientX - viewportRect.left + viewport.scrollLeft,
        sourceLocalY: event.clientY - viewportRect.top + viewport.scrollTop,
        sourceScrollLeft: viewport.scrollLeft,
        sourceScrollTop: viewport.scrollTop,
        boxActivationRequested: shouldActivateAnimationTimelineBoxSelection({
          boxAllowed: request.boxAllowed && request.scope !== undefined,
          multiSelectMode: request.multiSelectMode,
          pointerType: event.pointerType,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
        }),
        active: false,
        movementExceededThreshold: false,
        finished: false,
      };

      const getClientRect = () =>
        getAnimationTimelineBoxRect(
          session.sourceClientX,
          session.sourceClientY,
          session.currentClientX,
          session.currentClientY,
        );

      const updatePreview = () => {
        if (!session.scope) {
          return;
        }

        const currentLocalX =
          session.currentClientX - viewportRect.left + session.sourceScrollLeft;
        const currentLocalY =
          session.currentClientY - viewportRect.top + session.sourceScrollTop;
        const orderedHits = getVisibleHits(session.scope, getClientRect());
        const result = getAnimationTimelineBoxSelectionResult({
          scope: session.scope,
          orderedHits,
          sourceSelection: session.sourceSelection,
        });

        setPreview({
          scopeClipId: session.scope.clipId,
          overlayRect: getAnimationTimelineBoxRect(
            session.sourceLocalX,
            session.sourceLocalY,
            currentLocalX,
            currentLocalY,
          ),
          selectedKeyframes: orderedHits,
          primary: result?.primary,
        });
      };

      const cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        window.removeEventListener("keydown", handleKeyDown);
        viewport.removeEventListener("scroll", handleScroll);
        background.removeEventListener(
          "lostpointercapture",
          handleLostPointerCapture,
        );
        if (cancelSessionRef.current === cancelCurrentSession) {
          cancelSessionRef.current = null;
        }
      };

      const finish = (kind: "commit" | "cancel") => {
        if (session.finished) {
          return;
        }

        session.finished = true;
        cleanup();
        const wasActive = session.active;
        const finalClientRect = getClientRect();
        const finalHits =
          wasActive && session.scope
            ? getVisibleHits(session.scope, finalClientRect)
            : [];
        setPreview(null);

        if (background.hasPointerCapture(session.pointerId)) {
          background.releasePointerCapture(session.pointerId);
        }

        if (kind === "commit" && wasActive && session.scope) {
          latestCallbacksRef.current.onCommitBoxSelection(
            session.scope,
            getAnimationTimelineBoxSelectionResult({
              scope: session.scope,
              orderedHits: finalHits,
              sourceSelection: session.sourceSelection,
            }),
          );
        }
      };

      const cancelCurrentSession = () => finish("cancel");

      const promoteToBoxSelection = (moveEvent: PointerEvent) => {
        if (!session.boxActivationRequested || !session.scope) {
          return false;
        }

        try {
          background.setPointerCapture(session.pointerId);
        } catch {
          finish("cancel");
          return false;
        }

        session.active = true;
        background.addEventListener(
          "lostpointercapture",
          handleLostPointerCapture,
        );
        moveEvent.preventDefault();
        updatePreview();
        return true;
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== session.pointerId || session.finished) {
          return;
        }

        session.currentClientX = moveEvent.clientX;
        session.currentClientY = moveEvent.clientY;
        const movement = Math.hypot(
          session.currentClientX - session.sourceClientX,
          session.currentClientY - session.sourceClientY,
        );

        if (!session.movementExceededThreshold && movement < dragThresholdPx) {
          return;
        }

        session.movementExceededThreshold = true;

        if (!session.active && !promoteToBoxSelection(moveEvent)) {
          return;
        }

        if (session.active) {
          moveEvent.preventDefault();
          updatePreview();
        }
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== session.pointerId || session.finished) {
          return;
        }

        session.currentClientX = upEvent.clientX;
        session.currentClientY = upEvent.clientY;

        if (session.active) {
          finish("commit");
          return;
        }

        const finalMovementExceededThreshold =
          session.movementExceededThreshold ||
          Math.hypot(
            upEvent.clientX - session.sourceClientX,
            upEvent.clientY - session.sourceClientY,
          ) >= dragThresholdPx;
        const ordinaryClick =
          shouldCommitAnimationTimelineEmptyBackgroundClick({
            movementExceededThreshold: finalMovementExceededThreshold,
            pointerUpOnBackground: upEvent.target === background,
            ctrlKey: upEvent.ctrlKey,
            metaKey: upEvent.metaKey,
            shiftKey: upEvent.shiftKey,
            altKey: upEvent.altKey,
            playheadHit:
              Math.abs(
                upEvent.clientX - backgroundRect.left - request.playheadX,
              ) <= request.playheadHitRadiusPx,
          });

        finish("cancel");

        if (ordinaryClick) {
          latestCallbacksRef.current.onEmptyTimelineClick();
        }
      };

      const handlePointerCancel = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId === session.pointerId) {
          finish("cancel");
        }
      };

      const handleLostPointerCapture = () => {
        if (!session.finished) {
          finish("cancel");
        }
      };

      const handleKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== "Escape") {
          return;
        }

        if (session.active) {
          keyEvent.preventDefault();
        }
        finish("cancel");
      };

      const handleScroll = () => {
        if (
          viewport.scrollLeft !== session.sourceScrollLeft ||
          viewport.scrollTop !== session.sourceScrollTop
        ) {
          finish("cancel");
        }
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
      window.addEventListener("keydown", handleKeyDown);
      viewport.addEventListener("scroll", handleScroll);
      cancelSessionRef.current = cancelCurrentSession;
    },
    [dragThresholdPx, getVisibleHits, scrollViewportRef, selection],
  );

  useEffect(() => {
    cancelSessionRef.current?.();
  }, [contextKey, contextVersion, selection]);

  useEffect(
    () => () => {
      cancelSessionRef.current?.();
      cancelSessionRef.current = null;
      markersRef.current.clear();
    },
    [],
  );

  return {
    preview,
    registerMarker,
    handleBackgroundPointerDown,
    cancelBoxSelection: () => cancelSessionRef.current?.(),
  };
}
