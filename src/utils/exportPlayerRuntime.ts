/**
 * Standalone browser runtime injected into exported HTML.
 *
 * The editor can import the TypeScript presentation controller directly, while
 * a file:// HTML document cannot import the editor bundle. This runtime consumes
 * a plan generated from the shared controller/compiler rules and mirrors only
 * the DOM scheduling needed by the portable player.
 */
export function getExportPlayerRuntimeScript() {
  return String.raw`
    const EXPORT_WHEEL_TRIGGER_PX = 24;
    const EXPORT_WHEEL_GESTURE_END_MS = 240;

    let exportPresentationStarted = false;
    let exportPlaybackState = null;
    let exportPlaybackSlideNode = null;
    let exportPlaybackPlan = null;
    let exportPlaybackAnimationFrame = 0;
    let exportPlaybackClockStartedAt = 0;
    let exportPlaybackAnimations = new Map();
    let exportWheelGestureTimer = 0;
    let exportWheelGesture = {
      accumulatedDeltaY: 0,
      direction: 0,
      locked: false,
    };

    function isExportPresentationStarted() {
      return exportPresentationStarted;
    }

    /**
     * Open the single runtime gate that precedes normal page entry.
     *
     * This does not create playback state or advance a Sequence. The caller
     * mounts page one synchronously inside the same trusted click gesture.
     */
    function startExportPresentation() {
      if (exportPresentationStarted) {
        return false;
      }

      exportPresentationStarted = true;
      return true;
    }

    function getExportSequenceOrder(plan) {
      return Array.isArray(plan?.sequenceOrder)
        ? plan.sequenceOrder
        : [];
    }

    function createExportPageStartState(plan) {
      return {
        slideId: plan.slideId,
        completedSequenceIds: [],
        activeSequenceId: undefined,
        activeSequenceTimeMs: 0,
        activeSequenceDurationMs: 0,
      };
    }

    function completeExportActiveSequence(state) {
      if (!state?.activeSequenceId) {
        return state;
      }

      const activeSequenceId = state.activeSequenceId;

      return {
        ...state,
        completedSequenceIds: state.completedSequenceIds.includes(
          activeSequenceId,
        )
          ? state.completedSequenceIds
          : [...state.completedSequenceIds, activeSequenceId],
        activeSequenceId: undefined,
        activeSequenceTimeMs: 0,
        activeSequenceDurationMs: 0,
      };
    }

    function startExportSequence(state, sequenceId, plan) {
      const durationMs = Math.max(
        0,
        Number(plan.sequenceDurationMs?.[sequenceId] ?? 0),
      );
      const playingState = {
        ...state,
        activeSequenceId: sequenceId,
        activeSequenceTimeMs: 0,
        activeSequenceDurationMs: durationMs,
      };

      return durationMs > 0
        ? playingState
        : completeExportActiveSequence(playingState);
    }

    function enterExportSlide(plan, position = "start") {
      const state = createExportPageStartState(plan);

      if (position === "end") {
        return {
          ...state,
          completedSequenceIds: getExportSequenceOrder(plan),
        };
      }

      return plan.slideEnterSequenceId
        ? startExportSequence(state, plan.slideEnterSequenceId, plan)
        : state;
    }

    function advanceExportPlayback(state, plan) {
      if (state.slideId !== plan.slideId) {
        return {
          state: enterExportSlide(plan),
          navigation: "none",
        };
      }

      if (state.activeSequenceId) {
        return {
          state,
          navigation: "none",
        };
      }

      if (
        plan.slideEnterSequenceId &&
        !state.completedSequenceIds.includes(plan.slideEnterSequenceId)
      ) {
        return {
          state: startExportSequence(
            state,
            plan.slideEnterSequenceId,
            plan,
          ),
          navigation: "none",
        };
      }

      const nextClickStepId = (plan.clickStepSequenceIds || []).find(
        (sequenceId) => !state.completedSequenceIds.includes(sequenceId),
      );

      if (nextClickStepId) {
        return {
          state: startExportSequence(state, nextClickStepId, plan),
          navigation: "none",
        };
      }

      return {
        state,
        navigation: "next-slide",
      };
    }

    function forceAdvanceExportPlayback(state, plan) {
      if (state.slideId !== plan.slideId || !state.activeSequenceId) {
        return advanceExportPlayback(state, plan);
      }

      return {
        state: completeExportActiveSequence(state),
        navigation: "none",
      };
    }

    function retreatExportPlayback(state, plan) {
      if (state.slideId !== plan.slideId) {
        return {
          state: enterExportSlide(plan),
          navigation: "none",
        };
      }

      if (state.activeSequenceId) {
        return {
          state: {
            ...state,
            activeSequenceId: undefined,
            activeSequenceTimeMs: 0,
            activeSequenceDurationMs: 0,
          },
          navigation: "none",
        };
      }

      const finalCompletedClickStepId = [
        ...(plan.clickStepSequenceIds || []),
      ]
        .reverse()
        .find((sequenceId) =>
          state.completedSequenceIds.includes(sequenceId),
        );

      if (finalCompletedClickStepId) {
        return {
          state: {
            ...state,
            completedSequenceIds: state.completedSequenceIds.filter(
              (sequenceId) => sequenceId !== finalCompletedClickStepId,
            ),
          },
          navigation: "none",
        };
      }

      if (
        plan.slideEnterSequenceId &&
        state.completedSequenceIds.includes(plan.slideEnterSequenceId)
      ) {
        return {
          state: {
            ...state,
            completedSequenceIds: state.completedSequenceIds.filter(
              (sequenceId) => sequenceId !== plan.slideEnterSequenceId,
            ),
          },
          navigation: "none",
        };
      }

      return {
        state,
        navigation: "previous-slide",
      };
    }

    function getExportSequenceSamples(state, plan) {
      if (!state || state.slideId !== plan.slideId) {
        return [];
      }

      const samples = state.completedSequenceIds.map((sequenceId) => ({
        sequenceId,
        localTimeMs: Number(plan.sequenceDurationMs?.[sequenceId] ?? 0),
        phase: "completed",
      }));

      if (state.activeSequenceId) {
        samples.push({
          sequenceId: state.activeSequenceId,
          localTimeMs: state.activeSequenceTimeMs,
          phase: "active",
        });
      }

      getExportSequenceOrder(plan)
        .filter(
          (sequenceId) =>
            !state.completedSequenceIds.includes(sequenceId) &&
            state.activeSequenceId !== sequenceId,
        )
        .forEach((sequenceId) => {
          samples.push({
            sequenceId,
            localTimeMs: 0,
            phase: "pending",
          });
        });

      return samples;
    }

    function createExportBrowserKeyframes(compiledAnimation) {
      return (compiledAnimation.keyframes || []).map((frame) => {
        const keyframe = {
          offset: Number(frame.offset ?? 0),
        };

        if (typeof frame.opacity === "number") {
          keyframe.opacity = frame.opacity;
        }

        if (typeof frame.transform === "string") {
          keyframe.transform = frame.transform;
        }

        if (typeof frame.easing === "string") {
          keyframe.easing = frame.easing;
        }

        return keyframe;
      });
    }

    function normalizeExportPositiveNumber(value, fallback) {
      const numericValue = Number(value);

      return Number.isFinite(numericValue) && numericValue > 0
        ? numericValue
        : fallback;
    }

    function getExportOpacityFrames(animation) {
      if (!Array.isArray(animation?.keyframes)) {
        return [];
      }

      return animation.keyframes
        .flatMap((frame) => {
          if (
            typeof frame?.opacity !== "number" ||
            !Number.isFinite(frame.opacity)
          ) {
            return [];
          }

          const rawOffset = Number(frame.offset);

          return [
            {
              offset: Number.isFinite(rawOffset)
                ? Math.min(1, Math.max(0, rawOffset))
                : 0,
              opacity: frame.opacity,
            },
          ];
        })
        .sort((left, right) => left.offset - right.offset);
    }

    function sampleExportOpacityAtProgress(frames, progress) {
      const normalizedProgress = Math.min(1, Math.max(0, progress));
      const firstFrame = frames[0];
      const lastFrame = frames[frames.length - 1];

      if (!firstFrame || !lastFrame) {
        return undefined;
      }

      if (normalizedProgress <= firstFrame.offset) {
        return firstFrame.opacity;
      }

      if (normalizedProgress >= lastFrame.offset) {
        return lastFrame.opacity;
      }

      for (let index = 1; index < frames.length; index += 1) {
        const rightFrame = frames[index];
        const leftFrame = frames[index - 1];

        if (
          !rightFrame ||
          !leftFrame ||
          normalizedProgress > rightFrame.offset
        ) {
          continue;
        }

        const segmentLength = rightFrame.offset - leftFrame.offset;

        if (segmentLength <= 0) {
          return rightFrame.opacity;
        }

        const segmentProgress =
          (normalizedProgress - leftFrame.offset) / segmentLength;

        return (
          leftFrame.opacity +
          (rightFrame.opacity - leftFrame.opacity) * segmentProgress
        );
      }

      return lastFrame.opacity;
    }

    function getExportDirectedProgress(
      direction,
      iterationIndex,
      simpleProgress,
    ) {
      const reversed =
        direction === "reverse" ||
        (direction === "alternate" && iterationIndex % 2 === 1) ||
        (direction === "alternate-reverse" && iterationIndex % 2 === 0);

      return reversed ? 1 - simpleProgress : simpleProgress;
    }

    function getExportCompletedDirectedProgress(direction, iterationsValue) {
      const iterations = normalizeExportPositiveNumber(iterationsValue, 1);
      const completedWholeIterations = Math.floor(iterations);
      const fractionalIteration = iterations - completedWholeIterations;
      const hasFractionalIteration = fractionalIteration > 1e-8;
      const iterationIndex = hasFractionalIteration
        ? completedWholeIterations
        : Math.max(0, completedWholeIterations - 1);
      const simpleProgress = hasFractionalIteration ? fractionalIteration : 1;

      return getExportDirectedProgress(
        direction,
        iterationIndex,
        simpleProgress,
      );
    }

    function getExportPresentationInteractionState({
      staticOpacity,
      samples,
    }) {
      const normalizedStaticOpacity =
        typeof staticOpacity === "number" && Number.isFinite(staticOpacity)
          ? staticOpacity
          : 1;
      let state =
        normalizedStaticOpacity > 0
          ? { ownsInput: true, reason: "static-visible" }
          : { ownsInput: false, reason: "static-hidden" };
      let hasAuthoritativeOpacity = false;

      if (!Array.isArray(samples)) {
        return state;
      }

      samples.forEach((sample) => {
        const animation = sample?.compiledAnimation;

        if (!animation) {
          return;
        }

        const opacityFrames = getExportOpacityFrames(animation);

        if (opacityFrames.length === 0) {
          return;
        }

        const timing = animation.timing || {};

        if (sample.pendingBaseline) {
          if (hasAuthoritativeOpacity) {
            return;
          }

          const opacity = sampleExportOpacityAtProgress(
            opacityFrames,
            getExportDirectedProgress(timing.direction, 0, 0),
          );

          state =
            opacity !== undefined && opacity > 0
              ? { ownsInput: true, reason: "pending-opacity-visible" }
              : { ownsInput: false, reason: "pending-opacity-hidden" };
          return;
        }

        const phase = sample.sequenceSample?.phase;

        if (phase === "active") {
          const localTimeMs = Math.max(
            0,
            Number(sample.sequenceSample?.localTimeMs ?? 0),
          );
          const startTimeMs = Math.max(0, Number(timing.delay ?? 0));
          const durationMs = normalizeExportPositiveNumber(timing.duration, 1);
          const iterations = normalizeExportPositiveNumber(
            timing.iterations,
            1,
          );
          const playbackRate = normalizeExportPositiveNumber(
            animation.playbackRate,
            1,
          );
          const sampledAnimationTimeMs =
            Math.max(0, localTimeMs - startTimeMs) * playbackRate;
          const reachedEnd =
            sampledAnimationTimeMs >= durationMs * iterations;

          if (!reachedEnd) {
            state = { ownsInput: true, reason: "active-opacity" };
            hasAuthoritativeOpacity = true;
            return;
          }
        } else if (phase !== "completed") {
          return;
        }

        const keepsFinalFrame =
          timing.fill === "forwards" ||
          timing.fill === "both" ||
          timing.fill === undefined;

        if (!keepsFinalFrame) {
          return;
        }

        const completedOpacity = sampleExportOpacityAtProgress(
          opacityFrames,
          getExportCompletedDirectedProgress(
            timing.direction,
            timing.iterations,
          ),
        );

        state =
          completedOpacity !== undefined && completedOpacity > 0
            ? { ownsInput: true, reason: "completed-opacity-visible" }
            : { ownsInput: false, reason: "completed-opacity-hidden" };
        hasAuthoritativeOpacity = true;
      });

      return state;
    }

    function getExportElementAnimations(plan, elementId) {
      return getExportSequenceOrder(plan).flatMap(
        (sequenceId) =>
          plan.compiledBySequenceId?.[sequenceId]?.byElementId?.[elementId] ||
          [],
      );
    }

    /**
     * Resolve the exact compiled animations that may participate at this frame.
     *
     * A Sequence being active does not make its delayed Clips active. Until the
     * Sequence-local clock reaches timing.delay, earlier completed/active history
     * remains authoritative. If an element has no history at all, its earliest
     * active-or-pending Sequence may retain the pre-execution baseline that was
     * already visible while the Sequence was pending; this is not active Clip
     * participation and prevents the element's design-final state from leaking.
     */
    function getExportRenderableAnimationSamples(samples, elementAnimations) {
      const samplesBySequenceId = Object.fromEntries(
        samples.map((sample) => [sample.sequenceId, sample]),
      );
      const participatingAnimations = elementAnimations.flatMap(
        (compiledAnimation) => {
          const sequenceSample =
            samplesBySequenceId[compiledAnimation.sequenceId];
          const startTimeMs = Math.max(
            0,
            Number(compiledAnimation.timing?.delay ?? 0),
          );

          if (
            !sequenceSample ||
            sequenceSample.phase === "pending" ||
            Number(sequenceSample.localTimeMs ?? 0) < startTimeMs
          ) {
            return [];
          }

          return [
            {
              compiledAnimation,
              sequenceSample,
              pendingBaseline: false,
            },
          ];
        },
      );

      if (participatingAnimations.length > 0) {
        return participatingAnimations;
      }

      const baselineSample = samples.find(
        (sample) =>
          (sample.phase === "active" || sample.phase === "pending") &&
          elementAnimations.some(
            (animation) => animation.sequenceId === sample.sequenceId,
          ),
      );

      if (!baselineSample) {
        return [];
      }

      const baselineAnimations = elementAnimations.filter(
        (animation) => animation.sequenceId === baselineSample.sequenceId,
      );
      const earliestStartMs = Math.min(
        ...baselineAnimations.map((animation) =>
          Math.max(0, Number(animation.timing?.delay ?? 0)),
        ),
      );

      return baselineAnimations
        .filter(
          (animation) =>
            Math.max(0, Number(animation.timing?.delay ?? 0)) ===
            earliestStartMs,
        )
        .map((compiledAnimation) => ({
          compiledAnimation,
          sequenceSample: baselineSample,
          pendingBaseline: true,
        }));
    }

    function isExportMediaInputFullscreen(mediaInputNode) {
      const fullscreenElement = document.fullscreenElement;

      return Boolean(
        fullscreenElement &&
          (fullscreenElement === mediaInputNode ||
            mediaInputNode.contains(fullscreenElement)),
      );
    }

    function applyExportMediaInputOwner(
      animationNode,
      renderableAnimationSamples,
    ) {
      const mediaInputNode = animationNode.parentElement;

      if (!mediaInputNode?.classList.contains("element-media")) {
        return;
      }

      const staticOpacity = Number(mediaInputNode.style.opacity || 1);
      const interactionState = getExportPresentationInteractionState({
        staticOpacity,
        samples: renderableAnimationSamples,
      });

      /**
       * A fullscreen media node is already in the browser's input-owning top
       * layer. Presentation state may keep changing, but its ancestor must not
       * become inert until fullscreen exits.
       */
      const ownsInput =
        isExportMediaInputFullscreen(mediaInputNode) ||
        interactionState.ownsInput;
      const ownerValue = String(ownsInput);

      if (mediaInputNode.dataset.presentationInputOwner !== ownerValue) {
        mediaInputNode.dataset.presentationInputOwner = ownerValue;
        mediaInputNode.inert = !ownsInput;
        mediaInputNode.style.pointerEvents = ownsInput ? "" : "none";
      }

      if (
        !ownsInput &&
        document.activeElement instanceof HTMLElement &&
        mediaInputNode.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
    }

    function refreshExportPresentationInteractionOwnership() {
      if (
        !exportPlaybackState ||
        !exportPlaybackPlan ||
        !exportPlaybackSlideNode
      ) {
        return;
      }

      const samples = getExportSequenceSamples(
        exportPlaybackState,
        exportPlaybackPlan,
      );

      exportPlaybackSlideNode
        .querySelectorAll("[data-element-id]")
        .forEach((animationNode) => {
          const elementAnimations = getExportElementAnimations(
            exportPlaybackPlan,
            animationNode.dataset.elementId,
          );
          const renderableAnimationSamples =
            getExportRenderableAnimationSamples(samples, elementAnimations);

          applyExportMediaInputOwner(
            animationNode,
            renderableAnimationSamples,
          );
        });
    }

    function cancelExportPlaybackFrame() {
      if (!exportPlaybackAnimationFrame) {
        return;
      }

      window.cancelAnimationFrame(exportPlaybackAnimationFrame);
      exportPlaybackAnimationFrame = 0;
    }

    function cancelExportPlaybackAnimations() {
      exportPlaybackAnimations.forEach((animation) => animation.cancel());
      exportPlaybackAnimations.clear();
    }

    function sampleExportPlaybackState() {
      if (
        !exportPlaybackState ||
        !exportPlaybackPlan ||
        !exportPlaybackSlideNode
      ) {
        return;
      }

      const samples = getExportSequenceSamples(
        exportPlaybackState,
        exportPlaybackPlan,
      );
      const visibleAnimationIds = new Set();
      const animationNodes = exportPlaybackSlideNode.querySelectorAll(
        "[data-element-id]",
      );

      animationNodes.forEach((node) => {
        const elementId = node.dataset.elementId;
        const elementAnimations = getExportElementAnimations(
          exportPlaybackPlan,
          elementId,
        );
        const renderableAnimationSamples =
          getExportRenderableAnimationSamples(samples, elementAnimations);

        applyExportMediaInputOwner(
          node,
          renderableAnimationSamples,
        );

        renderableAnimationSamples.forEach(
          ({ compiledAnimation, sequenceSample, pendingBaseline }) => {
            const timing = compiledAnimation.timing || {};
            const startTimeMs = Math.max(0, Number(timing.delay ?? 0));
            const localTimeMs = pendingBaseline
              ? startTimeMs
              : Math.max(0, Number(sequenceSample.localTimeMs ?? 0));
            const playbackRate =
              Number(compiledAnimation.playbackRate) > 0
                ? Number(compiledAnimation.playbackRate)
                : 1;
            const elapsedTimelineMs = localTimeMs - startTimeMs;
            const durationMs = Math.max(1, Number(timing.duration ?? 1));
            const iterations = Math.max(1, Number(timing.iterations ?? 1));
            const totalAnimationTimeMs = durationMs * iterations;
            const sampledAnimationTimeMs =
              elapsedTimelineMs * playbackRate;
            const reachedEnd =
              sampledAnimationTimeMs >= totalAnimationTimeMs;
            const keepsFinalFrame =
              timing.fill === "forwards" || timing.fill === "both";

            if (reachedEnd && !keepsFinalFrame) {
              return;
            }

            const animationKey =
              elementId + "::" + compiledAnimation.id;
            let animation = exportPlaybackAnimations.get(animationKey);

            if (!animation) {
              const keyframes = createExportBrowserKeyframes(compiledAnimation);

              if (keyframes.length === 0) {
                return;
              }

              animation = node.animate(keyframes, {
                delay: 0,
                duration: durationMs,
                fill: timing.fill || "both",
                iterations,
                direction: timing.direction || "normal",
                easing: "linear",
              });
              animation.pause();
              exportPlaybackAnimations.set(animationKey, animation);
            }

            animation.pause();
            animation.currentTime = Math.min(
              totalAnimationTimeMs,
              Math.max(0, sampledAnimationTimeMs),
            );
            visibleAnimationIds.add(animationKey);
          },
        );
      });

      exportPlaybackAnimations.forEach((animation, animationKey) => {
        if (visibleAnimationIds.has(animationKey)) {
          return;
        }

        animation.cancel();
        exportPlaybackAnimations.delete(animationKey);
      });
    }

    function startExportPlaybackClock() {
      cancelExportPlaybackFrame();

      if (
        !exportPlaybackState?.activeSequenceId ||
        exportPlaybackState.activeSequenceDurationMs <= 0
      ) {
        return;
      }

      const slideId = exportPlaybackState.slideId;
      const sequenceId = exportPlaybackState.activeSequenceId;
      const durationMs = exportPlaybackState.activeSequenceDurationMs;

      exportPlaybackClockStartedAt =
        performance.now() - exportPlaybackState.activeSequenceTimeMs;

      function updateFrame(now) {
        if (
          !exportPlaybackState ||
          exportPlaybackState.slideId !== slideId ||
          exportPlaybackState.activeSequenceId !== sequenceId
        ) {
          return;
        }

        const nextLocalTimeMs = Math.min(
          durationMs,
          now - exportPlaybackClockStartedAt,
        );

        if (nextLocalTimeMs >= durationMs) {
          exportPlaybackState = completeExportActiveSequence({
            ...exportPlaybackState,
            activeSequenceTimeMs: durationMs,
          });
          exportPlaybackAnimationFrame = 0;
          sampleExportPlaybackState();
          return;
        }

        exportPlaybackState = {
          ...exportPlaybackState,
          activeSequenceTimeMs: nextLocalTimeMs,
        };
        sampleExportPlaybackState();
        exportPlaybackAnimationFrame =
          window.requestAnimationFrame(updateFrame);
      }

      exportPlaybackAnimationFrame =
        window.requestAnimationFrame(updateFrame);
    }

    function commitExportPlaybackState(nextState) {
      cancelExportPlaybackFrame();
      exportPlaybackState = nextState;
      sampleExportPlaybackState();
      startExportPlaybackClock();
    }

    function mountExportPlayback(
      slideNode,
      plan,
      position = "start",
      preserveState = false,
    ) {
      if (!exportPresentationStarted) {
        return false;
      }

      cancelExportPlaybackFrame();
      cancelExportPlaybackAnimations();
      exportPlaybackSlideNode = slideNode;
      exportPlaybackPlan = plan;

      if (
        !preserveState ||
        !exportPlaybackState ||
        exportPlaybackState.slideId !== plan.slideId
      ) {
        exportPlaybackState = enterExportSlide(plan, position);
      }

      sampleExportPlaybackState();
      startExportPlaybackClock();
      return true;
    }

    function handleExportAdvance() {
      if (
        !exportPresentationStarted ||
        !exportPlaybackState ||
        !exportPlaybackPlan
      ) {
        return;
      }

      const transition = advanceExportPlayback(
        exportPlaybackState,
        exportPlaybackPlan,
      );

      if (transition.navigation === "next-slide") {
        goToSlide(activeSlideIndex + 1, "start");
        return;
      }

      if (transition.state !== exportPlaybackState) {
        commitExportPlaybackState(transition.state);
      }
    }

    function handleExportForceAdvance() {
      if (
        !exportPresentationStarted ||
        !exportPlaybackState ||
        !exportPlaybackPlan
      ) {
        return;
      }

      const transition = forceAdvanceExportPlayback(
        exportPlaybackState,
        exportPlaybackPlan,
      );

      if (transition.navigation === "next-slide") {
        goToSlide(activeSlideIndex + 1, "start");
        return;
      }

      if (transition.state !== exportPlaybackState) {
        commitExportPlaybackState(transition.state);
      }
    }

    function handleExportRetreat() {
      if (
        !exportPresentationStarted ||
        !exportPlaybackState ||
        !exportPlaybackPlan
      ) {
        return;
      }

      const transition = retreatExportPlayback(
        exportPlaybackState,
        exportPlaybackPlan,
      );

      if (transition.navigation === "previous-slide") {
        goToSlide(activeSlideIndex - 1, "end");
        return;
      }

      if (transition.state !== exportPlaybackState) {
        commitExportPlaybackState(transition.state);
      }
    }

    function isExportPresentationInteractionTarget(target) {
      if (!(target instanceof Element)) {
        return false;
      }

      const explicitOwner = target.closest(
        '[data-presentation-input-owner]',
      );

      if (explicitOwner) {
        if (isExportMediaInputFullscreen(explicitOwner)) {
          return true;
        }

        const ownerValue = explicitOwner.dataset.presentationInputOwner;

        if (ownerValue === "false") {
          return false;
        }

        if (ownerValue === "true") {
          return true;
        }
      }

      return Boolean(
        target.closest(
          "audio, video, button, a, input, select, textarea, " +
            "[contenteditable='true'], [role='button']",
        ),
      );
    }

    function hasExportFullscreenMediaElement() {
      const fullscreenElement = document.fullscreenElement;

      return Boolean(
        fullscreenElement &&
          (fullscreenElement instanceof HTMLMediaElement ||
            fullscreenElement.querySelector?.("audio, video")),
      );
    }

    function isExportWheelInteractionTarget(target) {
      if (isExportPresentationInteractionTarget(target)) {
        return true;
      }

      if (!(target instanceof Element)) {
        return false;
      }

      if (
        target.closest(
          "[data-presentation-wheel-owner], [role='slider'], " +
            "[role='scrollbar'], [role='listbox'], [role='spinbutton']",
        )
      ) {
        return true;
      }

      let currentElement = target;

      while (
        currentElement &&
        currentElement !== document.body &&
        currentElement !== document.documentElement
      ) {
        if (currentElement instanceof HTMLElement) {
          const style = window.getComputedStyle(currentElement);
          const scrollsVertically =
            /^(auto|scroll|overlay)$/.test(style.overflowY) &&
            currentElement.scrollHeight > currentElement.clientHeight + 1;
          const scrollsHorizontally =
            /^(auto|scroll|overlay)$/.test(style.overflowX) &&
            currentElement.scrollWidth > currentElement.clientWidth + 1;

          if (scrollsVertically || scrollsHorizontally) {
            return true;
          }
        }

        currentElement = currentElement.parentElement;
      }

      return false;
    }

    function normalizeExportWheelDeltaY(event) {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return event.deltaY * 16;
      }

      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return event.deltaY * Math.max(1, window.innerHeight);
      }

      return event.deltaY;
    }

    function resetExportWheelGesture() {
      exportWheelGesture = {
        accumulatedDeltaY: 0,
        direction: 0,
        locked: false,
      };

      if (exportWheelGestureTimer) {
        window.clearTimeout(exportWheelGestureTimer);
        exportWheelGestureTimer = 0;
      }
    }

    function scheduleExportWheelGestureEnd() {
      if (exportWheelGestureTimer) {
        window.clearTimeout(exportWheelGestureTimer);
      }

      exportWheelGestureTimer = window.setTimeout(() => {
        exportWheelGesture = {
          accumulatedDeltaY: 0,
          direction: 0,
          locked: false,
        };
        exportWheelGestureTimer = 0;
      }, EXPORT_WHEEL_GESTURE_END_MS);
    }

    function handleExportWheel(event) {
      if (
        !exportPresentationStarted ||
        hasExportFullscreenMediaElement() ||
        event.ctrlKey ||
        event.metaKey ||
        isExportWheelInteractionTarget(event.target)
      ) {
        return;
      }

      const deltaY = normalizeExportWheelDeltaY(event);

      if (!Number.isFinite(deltaY) || Math.abs(deltaY) < 0.01) {
        return;
      }

      event.preventDefault();

      const direction = deltaY > 0 ? 1 : -1;

      if (!exportWheelGesture.locked) {
        if (
          exportWheelGesture.direction &&
          exportWheelGesture.direction !== direction
        ) {
          exportWheelGesture.accumulatedDeltaY = 0;
        }

        exportWheelGesture.direction = direction;
        exportWheelGesture.accumulatedDeltaY += deltaY;

        if (
          Math.abs(exportWheelGesture.accumulatedDeltaY) >=
          EXPORT_WHEEL_TRIGGER_PX
        ) {
          exportWheelGesture.locked = true;

          if (direction === 1) {
            handleExportForceAdvance();
          } else {
            handleExportRetreat();
          }
        }
      }

      scheduleExportWheelGestureEnd();
    }

    function handleExportPresentationClick(event) {
      if (
        !exportPresentationStarted ||
        hasExportFullscreenMediaElement() ||
        isExportPresentationInteractionTarget(event.target)
      ) {
        return;
      }

      handleExportAdvance();
    }
  `;
}
