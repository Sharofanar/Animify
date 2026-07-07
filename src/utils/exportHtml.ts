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
    let activeSlideIndex = Math.max(
      0,
      project.slides.findIndex((slide) => slide.id === project.activeSlideId),
    );

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

    function createElementNode(element) {
      const style = element.style || {};
      const asset = getAsset(element.assetId);
      const node = document.createElement("div");

      node.className =
        element.type === "image" ? "element element-image" : "element";

      node.style.left = \`\${style.x ?? 0}px\`;
      node.style.top = \`\${style.y ?? 0}px\`;
      node.style.width = \`\${style.width ?? 0}px\`;
      node.style.height = \`\${style.height ?? 0}px\`;
      node.style.transform = \`rotate(\${style.rotate ?? 0}deg)\`;
      node.style.opacity = String(style.opacity ?? 1);
      node.style.color = style.color ?? "#0f172a";
      node.style.backgroundColor = style.backgroundColor ?? "transparent";
      node.style.fontSize = \`\${style.fontSize ?? 16}px\`;
      node.style.fontWeight = String(style.fontWeight ?? 400);
      node.style.borderRadius = \`\${style.borderRadius ?? 0}px\`;

      // Image elements only store assetId on the slide. Resolve the real image
      // data from project.assets so exported presentations show the image
      // instead of the file name.
      if (element.type === "image" && asset?.type === "image") {
        const image = document.createElement("img");

        image.src = asset.source;
        image.alt = asset.name || element.name || "image";
        image.draggable = false;
        image.style.borderRadius = \`\${style.borderRadius ?? 0}px\`;

        node.appendChild(image);
        return node;
      }

      node.innerHTML = escapeHtml(element.content || "");
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
