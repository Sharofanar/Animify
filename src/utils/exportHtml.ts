import type { PresentationProject, SlideElement } from "../types/presentation";

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

function createHtmlDocument(project: PresentationProject) {
  const firstSlide = project.slides[0];

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.name)}</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #e5e7eb;
      font-family:
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    .slide {
      position: relative;
      width: ${project.width}px;
      height: ${project.height}px;
      overflow: hidden;
      background: ${firstSlide?.backgroundColor ?? "#ffffff"};
      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18);
      transform-origin: center;
    }

    .element {
      position: absolute;
      display: block;
    }

    .element-content {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.2;
    }

    @keyframes fade-in {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    @keyframes slide-up {
      from {
        opacity: 0;
        transform: translateY(32px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes zoom-in {
      from {
        opacity: 0;
        transform: scale(0.85);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @media (max-width: ${project.width + 80}px) {
      .slide {
        transform: scale(calc((100vw - 40px) / ${project.width}));
      }
    }
  </style>
</head>
<body>
  <main class="slide">
${(firstSlide?.elements ?? []).map(createElementHtml).join("\n")}
  </main>
</body>
</html>`;
}

function createElementHtml(element: SlideElement) {
  const style = element.style;
  const animation = element.animations[0];

  return `    <div
      class="element"
      style="
        left: ${style.x}px;
        top: ${style.y}px;
        width: ${style.width}px;
        height: ${style.height}px;
        transform: rotate(${style.rotate}deg);
        opacity: ${style.opacity};
      "
    >
      <div
        class="element-content"
        style="
          color: ${style.color ?? "#0f172a"};
          background: ${style.backgroundColor ?? "transparent"};
          font-size: ${style.fontSize ?? 16}px;
          font-weight: ${style.fontWeight ?? 400};
          border-radius: ${style.borderRadius ?? 0}px;
          ${animation ? `animation: ${animation.keyframes} ${animation.duration}ms ${animation.easing} ${animation.delay}ms both;` : ""}
        "
      >${escapeHtml(element.content)}</div>
    </div>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
