import type { PresentationProject } from "../types/presentation";
import { compileSlideAnimations } from "./animationCompiler";

/**
 * Export the current Animify project as a standalone HTML file.
 *
 * Current image assets are stored as Data URLs in project.assets, so embedding
 * the whole project JSON is enough for the exported file to display images on
 * another computer. Large video assets should later move to a ZIP export flow.
 */
export function exportProjectAsHtml(project: PresentationProject) {
  const html = createHtmlDocument(project);
  const blob = new Blob([html], {
    type: "text/html;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${project.name || "animify-presentation"}.html`;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Create a complete HTML player.
 *
 * The exported player keeps all slide data and asset references inside one
 * document, so users can open the file directly without installing Animify.
 */
function createHtmlDocument(project: PresentationProject) {
  const serializedProject = escapeScriptJson(project);

  /**
   * Compile every slide before export.
   *
   * The exported player receives the same browser-ready animation data used by
   * SlideCanvas, so canvas preview, presentation mode, and HTML export share one
   * animation compiler.
   */
  const compiledAnimationsBySlide = Object.fromEntries(
    project.slides.map((slide) => [
      slide.id,
      compileSlideAnimations(slide.animationScene),
    ]),
  );

  const serializedCompiledAnimations = escapeScriptJson(
    compiledAnimationsBySlide,
  );

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(project.name || "Animify Presentation")}</title>
  <style>
    :root {
      color-scheme: dark;
      font-family:
        Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
        "Segoe UI", "Microsoft YaHei", sans-serif;
      background: #020617;
      color: #f8fafc;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      overflow: hidden;
      background:
        radial-gradient(circle at top left, rgba(124, 58, 237, 0.26), transparent 34rem),
        #020617;
    }

    #app {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .slide {
      position: relative;
      overflow: hidden;
      box-shadow: 0 28px 90px rgba(15, 23, 42, 0.55);
    }

    .element {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      white-space: pre-wrap;
      text-align: center;
      line-height: 1.2;
      transform-origin: center center;
    }

    .element-image {
      background: transparent !important;
    }

    .element-image img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
      user-select: none;
      pointer-events: none;
    }

    .element-content {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      white-space: pre-wrap;
      text-align: center;
      line-height: 1.2;
    }

    .controls {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 20;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      padding: 10px;
      background: rgba(15, 23, 42, 0.82);
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.32);
      backdrop-filter: blur(18px);
    }

    .controls button {
      height: 38px;
      min-width: 38px;
      border: 0;
      border-radius: 999px;
      padding: 0 14px;
      background: #ffffff;
      color: #0f172a;
      cursor: pointer;
      font-weight: 800;
      transition:
        transform 160ms ease,
        background 160ms ease;
    }

    .controls button:hover {
      transform: translateY(-1px);
      background: #ede9fe;
    }

    .counter {
      min-width: 64px;
      text-align: center;
      font-size: 13px;
      font-weight: 800;
      color: #c4b5fd;
    }

    .hint {
      position: fixed;
      left: 24px;
      bottom: 24px;
      z-index: 20;
      color: rgba(226, 232, 240, 0.72);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="app"></div>

  <div class="controls" aria-label="放映控制">
    <button type="button" id="prevButton">上一页</button>
    <span class="counter" id="slideCounter"></span>
    <button type="button" id="nextButton">下一页</button>
  </div>

  <div class="hint">方向键 / 空格翻页，Esc 可退出全屏</div>

  <script>
    const project = ${serializedProject};
    const compiledAnimationsBySlide = ${serializedCompiledAnimations};

    // Exported presentations should always start from the first slide,
    // no matter which slide was active when the user clicked export.
    let activeSlideIndex = 0;

    const app = document.getElementById("app");
    const prevButton = document.getElementById("prevButton");
    const nextButton = document.getElementById("nextButton");
    const slideCounter = document.getElementById("slideCounter");

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function getAsset(assetId) {
      if (!assetId || !project.assets) {
        return undefined;
      }

      return project.assets[assetId];
    }

    /**
     * Play Animation Schema V2 compiler output on the exported slide.
     *
     * Animation data is already compiled before export, so this player only needs
     * to create Web Animations API instances from the serialized keyframes.
     */
    function playSlideAnimations(slideNode, compiledSlideAnimations) {
      const animationNodes = slideNode.querySelectorAll("[data-element-id]");

      animationNodes.forEach((node) => {
        // Cancel existing animations before replaying a slide or handling resize.
        node.getAnimations().forEach((animation) => {
          animation.cancel();
        });

        const elementId = node.dataset.elementId;
        const elementAnimations =
          compiledSlideAnimations?.byElementId?.[elementId] || [];

        elementAnimations.forEach((compiledAnimation) => {
          const keyframes = (compiledAnimation.keyframes || []).map((frame) => {
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

          if (keyframes.length === 0) {
            return;
          }

          const timing = compiledAnimation.timing || {};

          const runningAnimation = node.animate(keyframes, {
            delay: Math.max(0, Number(timing.delay ?? 0)),
            duration: Math.max(1, Number(timing.duration ?? 1)),
            fill: timing.fill || "both",
            iterations: Math.max(1, Number(timing.iterations ?? 1)),
            direction: timing.direction || "normal",

            // Every compiled keyframe can contain its own segment easing.
            easing: "linear",
          });

          runningAnimation.playbackRate =
            Number(compiledAnimation.playbackRate) > 0
              ? Number(compiledAnimation.playbackRate)
              : 1;
        });
      });
    }

    function createElementNode(element, compiledSlideAnimations) {
      const style = element.style || {};
      const asset = getAsset(element.assetId);

      const elementAnimations =
        compiledSlideAnimations?.byElementId?.[element.id] || [];

      /**
       * Only backward-filling animations need their first frame applied before
       * element.animate() starts. This prevents entrance animations from briefly
       * flashing their final state during the first rendered frame.
       */
      const initialAnimation = elementAnimations.find((animation) => {
        const fill = animation.timing?.fill;

        return fill === "backwards" || fill === "both";
      });

      const initialFrame = initialAnimation?.keyframes?.[0];

      const node = document.createElement("div");
      const contentNode = document.createElement("div");

      node.className =
        element.type === "image" ? "element element-image" : "element";

      node.style.left = String(style.x ?? 0) + "px";
      node.style.top = String(style.y ?? 0) + "px";
      node.style.width = String(style.width ?? 0) + "px";
      node.style.height = String(style.height ?? 0) + "px";
      node.style.transform = "rotate(" + String(style.rotate ?? 0) + "deg)";
      node.style.opacity = String(style.opacity ?? 1);

      contentNode.className = "element-content";
      contentNode.dataset.elementId = element.id;
      contentNode.style.color = style.color ?? "#0f172a";
      contentNode.style.backgroundColor = style.backgroundColor ?? "transparent";
      contentNode.style.fontSize = String(style.fontSize ?? 16) + "px";
      contentNode.style.fontWeight = String(style.fontWeight ?? 400);
      contentNode.style.borderRadius = String(style.borderRadius ?? 0) + "px";

      if (typeof initialFrame?.opacity === "number") {
        contentNode.style.opacity = String(initialFrame.opacity);
      }

      if (typeof initialFrame?.transform === "string") {
        contentNode.style.transform = initialFrame.transform;
      }


      // Image elements only store assetId on the slide. Resolve the real image
      // data from project.assets so exported presentations show the image
      // instead of the file name.
      if (element.type === "image" && asset?.type === "image") {
        const image = document.createElement("img");

        image.src = asset.source;
        image.alt = asset.name || element.name || "image";
        image.draggable = false;
        image.style.borderRadius = String(style.borderRadius ?? 0) + "px";

        contentNode.appendChild(image);
        node.appendChild(contentNode);
        return node;
      }

      contentNode.innerHTML = escapeHtml(element.content || "");
      node.appendChild(contentNode);

      return node;
    }

    function renderSlide() {
      const slide = project.slides[activeSlideIndex];

      if (!slide) {
        app.innerHTML = "<p>没有找到可播放的页面。</p>";
        return;
      }

      const compiledSlideAnimations =
        compiledAnimationsBySlide[slide.id] || {
          revision: 0,
          byElementId: {},
          diagnostics: [],
        };

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scale = Math.min(
        viewportWidth / project.width,
        viewportHeight / project.height,
      );

      const slideNode = document.createElement("section");

      slideNode.className = "slide";
      slideNode.style.width = \`\${project.width}px\`;
      slideNode.style.height = \`\${project.height}px\`;
      slideNode.style.backgroundColor = slide.backgroundColor || "#f8fafc";
      slideNode.style.transform = \`scale(\${scale})\`;

      for (const element of slide.elements || []) {
        slideNode.appendChild(
          createElementNode(element, compiledSlideAnimations),
        );
      }

      app.replaceChildren(slideNode);

      // Play exported animations after the slide has been mounted into the DOM.
      // requestAnimationFrame makes page switching more reliable, especially
      // when the browser needs one frame to apply the newly inserted elements.
      requestAnimationFrame(() => {
        playSlideAnimations(slideNode, compiledSlideAnimations);
      });

      slideCounter.textContent = \`\${activeSlideIndex + 1} / \${project.slides.length}\`;
      prevButton.disabled = activeSlideIndex <= 0;
      nextButton.disabled = activeSlideIndex >= project.slides.length - 1;
    }

    function goToSlide(nextIndex) {
      if (nextIndex < 0 || nextIndex >= project.slides.length) {
        return;
      }

      activeSlideIndex = nextIndex;
      renderSlide();
    }

    prevButton.addEventListener("click", () => {
      goToSlide(activeSlideIndex - 1);
    });

    nextButton.addEventListener("click", () => {
      goToSlide(activeSlideIndex + 1);
    });

    window.addEventListener("keydown", (event) => {
      if (
        event.key === "ArrowRight" ||
        event.key === " " ||
        event.key === "Enter" ||
        event.key === "PageDown"
      ) {
        event.preventDefault();
        goToSlide(activeSlideIndex + 1);
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goToSlide(activeSlideIndex - 1);
        return;
      }

      if (event.key === "Escape" && document.fullscreenElement) {
        event.preventDefault();
        document.exitFullscreen();
      }
    });

    window.addEventListener("resize", renderSlide);

    renderSlide();
  </script>
</body>
</html>`;
}

/**
 * Safely serialize project data into a script tag.
 *
 * Replacing '<' prevents a project string from accidentally closing the script
 * tag, for example through '</script>' inside user-entered text.
 */
function escapeScriptJson(value: unknown) {
  const serializedValue = JSON.stringify(value);

  return (serializedValue ?? "null").replaceAll("<", "\\u003c");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
