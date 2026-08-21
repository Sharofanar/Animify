import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

const DEFAULT_TIMELINE_HEIGHT_PX = 360;
const DEFAULT_TIMELINE_HEIGHT_RATIO = 0.38;
const MIN_TIMELINE_HEIGHT_PX = 320;
const MAX_INITIAL_TIMELINE_HEIGHT_PX = 440;
const MAX_TIMELINE_HEIGHT_PX = 600;
const MIN_CANVAS_HEIGHT_PX = 320;
const SPLITTER_HEIGHT_PX = 12;
const KEYBOARD_RESIZE_STEP_PX = 16;

type AnimationWorkspaceLayoutProps = {
  canvas: ReactNode;
  minimumCanvasHeight: number;
  timeline: ReactNode;
  timelineVisible: boolean;
};

type TimelineHeightBounds = {
  min: number;
  max: number;
};

type ResizeSession = {
  pointerId: number;
  startPointerY: number;
  startTimelineHeight: number;
  latestTimelineHeight: number;
  frameId: number | null;
  target: HTMLDivElement;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTimelineHeightBounds(
  availableHeight: number,
  minimumCanvasHeight: number,
): TimelineHeightBounds {
  if (!Number.isFinite(availableHeight) || availableHeight <= 0) {
    return {
      min: MIN_TIMELINE_HEIGHT_PX,
      max: MAX_TIMELINE_HEIGHT_PX,
    };
  }

  const safeAvailableHeight = Math.max(0, availableHeight);
  const requiredCanvasHeight = Number.isFinite(minimumCanvasHeight)
    ? Math.max(MIN_CANVAS_HEIGHT_PX, Math.ceil(minimumCanvasHeight))
    : MIN_CANVAS_HEIGHT_PX;
  const maxForCanvas = Math.max(
    0,
    safeAvailableHeight - requiredCanvasHeight - SPLITTER_HEIGHT_PX,
  );
  const maximum = Math.max(
    0,
    Math.floor(
      Math.min(
        MAX_TIMELINE_HEIGHT_PX,
        safeAvailableHeight * 0.62,
        maxForCanvas,
      ),
    ),
  );

  return {
    /** On unusually short viewports, both 320px minima cannot physically fit. */
    min: Math.min(MIN_TIMELINE_HEIGHT_PX, maximum),
    max: maximum,
  };
}

function getDefaultTimelineHeight(
  availableHeight: number,
  bounds: TimelineHeightBounds,
) {
  if (!Number.isFinite(availableHeight) || availableHeight <= 0) {
    return clamp(DEFAULT_TIMELINE_HEIGHT_PX, bounds.min, bounds.max);
  }

  const preferredHeight = clamp(
    availableHeight * DEFAULT_TIMELINE_HEIGHT_RATIO,
    MIN_TIMELINE_HEIGHT_PX,
    MAX_INITIAL_TIMELINE_HEIGHT_PX,
  );

  return clamp(Math.round(preferredHeight), bounds.min, bounds.max);
}

/**
 * Owns only the transient vertical geometry between the editor Canvas and
 * Timeline. Document state and both children's interaction domains stay opaque.
 */
export function AnimationWorkspaceLayout({
  canvas,
  minimumCanvasHeight,
  timeline,
  timelineVisible,
}: AnimationWorkspaceLayoutProps) {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const timelineWrapperRef = useRef<HTMLDivElement | null>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [requestedTimelineHeight, setRequestedTimelineHeight] = useState<
    number | null
  >(null);

  const heightBounds = useMemo(
    () => getTimelineHeightBounds(availableHeight, minimumCanvasHeight),
    [availableHeight, minimumCanvasHeight],
  );
  const timelineHeight = clamp(
    requestedTimelineHeight ??
      getDefaultTimelineHeight(availableHeight, heightBounds),
    heightBounds.min,
    heightBounds.max,
  );

  const applyTimelineHeight = useCallback((height: number) => {
    const timelineWrapper = timelineWrapperRef.current;

    if (timelineWrapper) {
      timelineWrapper.style.height = `${height}px`;
    }
  }, []);

  const finishResize = useCallback(
    (outcome: "commit" | "cancel") => {
      const session = resizeSessionRef.current;

      if (!session) {
        return;
      }

      resizeSessionRef.current = null;

      if (session.frameId !== null) {
        window.cancelAnimationFrame(session.frameId);
      }

      const finalHeight =
        outcome === "commit"
          ? session.latestTimelineHeight
          : session.startTimelineHeight;

      applyTimelineHeight(finalHeight);

      if (outcome === "commit") {
        setRequestedTimelineHeight((currentHeight) =>
          currentHeight === finalHeight ? currentHeight : finalHeight,
        );
      }

      try {
        if (session.target.hasPointerCapture(session.pointerId)) {
          session.target.releasePointerCapture(session.pointerId);
        }
      } catch {
        /** The target may already be detached during unmount cleanup. */
      }
    },
    [applyTimelineHeight],
  );

  useEffect(() => {
    const workspace = workspaceRef.current;

    if (!workspace) {
      return;
    }

    function updateAvailableHeight() {
      const nextHeight = Math.round(
        workspace!.getBoundingClientRect().height,
      );

      setAvailableHeight((currentHeight) =>
        currentHeight === nextHeight ? currentHeight : nextHeight,
      );
    }

    updateAvailableHeight();

    const resizeObserver = new ResizeObserver(updateAvailableHeight);
    resizeObserver.observe(workspace);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!resizeSessionRef.current) {
      applyTimelineHeight(timelineHeight);
    }
  }, [applyTimelineHeight, timelineHeight]);

  useEffect(() => {
    if (!timelineVisible) {
      finishResize("cancel");
    }
  }, [finishResize, timelineVisible]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && resizeSessionRef.current) {
        event.preventDefault();
        finishResize("cancel");
      }
    }

    function handleWindowBlur() {
      finishResize("cancel");
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
      finishResize("cancel");
    };
  }, [finishResize]);

  function getPointerTimelineHeight(session: ResizeSession, clientY: number) {
    const liveAvailableHeight =
      workspaceRef.current?.getBoundingClientRect().height ?? availableHeight;
    const liveBounds = getTimelineHeightBounds(
      liveAvailableHeight,
      minimumCanvasHeight,
    );
    /** Moving the horizontal splitter upward gives the lower pane more room. */
    const deltaY = session.startPointerY - clientY;

    return clamp(
      Math.round(session.startTimelineHeight + deltaY),
      liveBounds.min,
      liveBounds.max,
    );
  }

  function queuePointerHeight(session: ResizeSession, clientY: number) {
    session.latestTimelineHeight = getPointerTimelineHeight(session, clientY);

    if (session.frameId !== null) {
      return;
    }

    session.frameId = window.requestAnimationFrame(() => {
      session.frameId = null;

      if (resizeSessionRef.current === session) {
        applyTimelineHeight(session.latestTimelineHeight);
      }
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      !timelineVisible ||
      !event.isPrimary ||
      event.button !== 0 ||
      resizeSessionRef.current
    ) {
      return;
    }

    const target = event.currentTarget;
    const startTimelineHeight = Math.round(
      timelineWrapperRef.current?.getBoundingClientRect().height ??
        timelineHeight,
    );

    target.setPointerCapture(event.pointerId);
    resizeSessionRef.current = {
      pointerId: event.pointerId,
      startPointerY: event.clientY,
      startTimelineHeight,
      latestTimelineHeight: startTimelineHeight,
      frameId: null,
      target,
    };
    event.preventDefault();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const session = resizeSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    queuePointerHeight(session, event.clientY);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const session = resizeSessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    session.latestTimelineHeight = getPointerTimelineHeight(
      session,
      event.clientY,
    );
    finishResize("commit");
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (resizeSessionRef.current?.pointerId === event.pointerId) {
      finishResize("cancel");
    }
  }

  function handleLostPointerCapture(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (resizeSessionRef.current?.pointerId === event.pointerId) {
      finishResize("cancel");
    }
  }

  function handleSeparatorKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    const currentHeight = Math.round(
      timelineWrapperRef.current?.getBoundingClientRect().height ??
        timelineHeight,
    );
    let nextHeight: number | null = null;

    if (event.key === "ArrowUp") {
      nextHeight = currentHeight + KEYBOARD_RESIZE_STEP_PX;
    } else if (event.key === "ArrowDown") {
      nextHeight = currentHeight - KEYBOARD_RESIZE_STEP_PX;
    } else if (event.key === "Home") {
      nextHeight = heightBounds.min;
    } else if (event.key === "End") {
      nextHeight = heightBounds.max;
    }

    if (nextHeight === null) {
      return;
    }

    event.preventDefault();
    setRequestedTimelineHeight(
      clamp(nextHeight, heightBounds.min, heightBounds.max),
    );
  }

  return (
    <div ref={workspaceRef} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">{canvas}</div>

      {timelineVisible ? (
        <>
          <div
            role="separator"
            aria-label="调整画布与动画时间轴的高度"
            aria-orientation="horizontal"
            aria-valuemin={heightBounds.min}
            aria-valuemax={heightBounds.max}
            aria-valuenow={Math.round(timelineHeight)}
            aria-valuetext={`时间轴高度 ${Math.round(timelineHeight)} 像素`}
            tabIndex={0}
            className="group flex h-3 shrink-0 touch-none cursor-row-resize items-center outline-none"
            onKeyDown={handleSeparatorKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onLostPointerCapture={handleLostPointerCapture}
          >
            <div className="h-0.5 w-full bg-slate-200 transition-colors group-hover:bg-violet-400 group-focus:bg-violet-500" />
          </div>

          <div
            ref={timelineWrapperRef}
            className="min-h-0 shrink-0"
            style={{ height: timelineHeight }}
          >
            {timeline}
          </div>
        </>
      ) : null}
    </div>
  );
}
