import type { PresentationProject } from "../types/presentation";

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
      object-fit: cover;
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

    @keyframes fade-in-up {
      from {
        opacity: 0;
        transform: translateY(28px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fade-in {
      from {
        opacity: 0;
      }

      to {
        opacity: 1;
      }
    }

    @keyframes scale-in {
      from {
        opacity: 0;
        transform: scale(0.92);
      }

      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes pulse {
      0%,
      100% {
        transform: scale(1);
      }

      50% {
        transform: scale(1.05);
      }
    }

    @keyframes float {
      0%,
      100% {
        transform: translateY(0);
      }

      50% {
        transform: translateY(-14px);
      }
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
    
    function getAnimationFrames(animationName) {
      // Keep these names aligned with PropertyPanel animationPresets.
      // The editor currently saves animation.keyframes as:
      // "fade-in", "slide-up", or "zoom-in".
      if (animationName === "fade-in") {
        return [
          { opacity: 0 },
          { opacity: 1 },
        ];
      }

      if (animationName === "slide-up") {
        return [
          { opacity: 0, transform: "translateY(28px)" },
          { opacity: 1, transform: "translateY(0)" },
        ];
      }

      if (animationName === "zoom-in") {
        return [
          { opacity: 0, transform: "scale(0.92)" },
          { opacity: 1, transform: "scale(1)" },
        ];
      }

      // Backward-compatible names used by the original demo data or older exports.
      if (animationName === "fade-in-up") {
        return [
          { opacity: 0, transform: "translateY(28px)" },
          { opacity: 1, transform: "translateY(0)" },
        ];
      }

      if (animationName === "scale-in") {
        return [
          { opacity: 0, transform: "scale(0.92)" },
          { opacity: 1, transform: "scale(1)" },
        ];
      }

      if (animationName === "pulse") {
        return [
          { transform: "scale(1)" },
          { transform: "scale(1.05)" },
          { transform: "scale(1)" },
        ];
      }

      if (animationName === "float") {
        return [
          { transform: "translateY(0)" },
          { transform: "translateY(-14px)" },
          { transform: "translateY(0)" },
        ];
      }

      return null;
    }

    function playSlideAnimations(slideNode) {
      const animatedNodes = slideNode.querySelectorAll("[data-animation-name]");

      animatedNodes.forEach((node) => {
        const animationName = node.dataset.animationName;
        const animationFrames = getAnimationFrames(animationName);

        if (!animationFrames) {
          return;
        }

        // Cancel existing animations first so changing slides or resizing the
        // browser can replay the animation from the beginning.
        node.getAnimations().forEach((animation) => {
          animation.cancel();
        });

        node.animate(animationFrames, {
          duration: Number(node.dataset.animationDuration || 600),
          delay: Number(node.dataset.animationDelay || 0),
          easing: node.dataset.animationEasing || "ease-out",
          fill: "both",
        });
      });
    }

          function createElementNode(element) {
      const style = element.style || {};
      const animation = element.animations?.[0];
      const asset = getAsset(element.assetId);
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
      contentNode.style.color = style.color ?? "#0f172a";
      contentNode.style.backgroundColor = style.backgroundColor ?? "transparent";
      contentNode.style.fontSize = String(style.fontSize ?? 16) + "px";
      contentNode.style.fontWeight = String(style.fontWeight ?? 400);
      contentNode.style.borderRadius = String(style.borderRadius ?? 0) + "px";

            
      // Store animation metadata on the inner content node. The exported player
      // will actively replay these animations after each slide render.
      if (animation) {
        contentNode.dataset.animationName = animation.keyframes;
        contentNode.dataset.animationDuration = String(animation.duration ?? 600);
        contentNode.dataset.animationDelay = String(animation.delay ?? 0);
        contentNode.dataset.animationEasing = animation.easing || "ease-out";
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
        slideNode.appendChild(createElementNode(element));
      }

      app.replaceChildren(slideNode);

      // Play exported animations after the slide has been mounted into the DOM.
      // requestAnimationFrame makes page switching more reliable, especially
      // when the browser needs one frame to apply the newly inserted elements.
      requestAnimationFrame(() => {
        playSlideAnimations(slideNode);
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
function escapeScriptJson(project: PresentationProject) {
  return JSON.stringify(project).replaceAll("<", "\\u003c");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
