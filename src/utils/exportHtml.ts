import type {
  PresentationProject,
  Slide,
  SlideElement,
} from "../types/presentation";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderElement(element: SlideElement) {
  const style = element.style;
  const animation = element.animations[0];

  return `
    <div
      class="slide-element"
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
        class="slide-element-inner"
        style="
          color: ${style.color ?? "#0f172a"};
          background: ${style.backgroundColor ?? "transparent"};
          font-size: ${style.fontSize ?? 16}px;
          font-weight: ${style.fontWeight ?? 400};
          border-radius: ${style.borderRadius ?? 0}px;
          ${
            animation
              ? `animation: ${animation.keyframes} ${animation.duration}ms ${animation.easing} ${animation.delay}ms both;`
              : ""
          }
        "
      >
        ${escapeHtml(element.content)}
      </div>
    </div>
  `;
}

function renderSlide(slide: Slide, index: number) {
  return `
    <section
      class="slide ${index === 0 ? "active" : ""}"
      data-slide-index="${index}"
      style="background: ${slide.backgroundColor};"
    >
      ${slide.elements.map(renderElement).join("")}
    </section>
  `;
}

function createHtmlDocument(project: PresentationProject) {
  const safeTitle = escapeHtml(project.name || "Animify 演示");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>
    * {
      box-sizing: border-box;
    }

    html,
    body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #020617;
      font-family:
        Inter,
        ui-sans-serif,
        system-ui,
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;
    }

    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #stage {
      position: relative;
      width: ${project.width}px;
      height: ${project.height}px;
      overflow: hidden;
      background: #020617;
      transform-origin: center center;
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.38);
    }

    .slide {
      position: absolute;
      inset: 0;
      display: none;
      overflow: hidden;
    }

    .slide.active {
      display: block;
    }

    .slide-element {
      position: absolute;
      display: flex;
      align-items: stretch;
      justify-content: stretch;
    }

    .slide-element-inner {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      text-align: center;
    }

    #page-indicator {
      position: fixed;
      right: 18px;
      bottom: 16px;
      z-index: 10;
      border-radius: 999px;
      padding: 8px 14px;
      background: rgba(15, 23, 42, 0.72);
      color: white;
      font-size: 13px;
      font-weight: 700;
      backdrop-filter: blur(12px);
      user-select: none;
    }

    #help {
      position: fixed;
      left: 18px;
      bottom: 16px;
      z-index: 10;
      border-radius: 999px;
      padding: 8px 14px;
      background: rgba(15, 23, 42, 0.72);
      color: white;
      font-size: 13px;
      font-weight: 700;
      backdrop-filter: blur(12px);
      user-select: none;
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

    @keyframes fade-in-up {
      from {
        opacity: 0;
        transform: translateY(24px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  </style>
</head>
<body>
  <main id="stage">
    ${project.slides.map(renderSlide).join("")}
  </main>

  <div id="help">点击 / 空格 / 方向键翻页</div>
  <div id="page-indicator">1 / ${project.slides.length}</div>

  <script>
    const stage = document.querySelector("#stage");
    const slides = Array.from(document.querySelectorAll(".slide"));
    const indicator = document.querySelector("#page-indicator");
    let currentSlideIndex = 0;

    function fitStage() {
      const scale = Math.min(
        window.innerWidth / ${project.width},
        window.innerHeight / ${project.height}
      );

      stage.style.transform = "scale(" + scale + ")";
    }

    function replayAnimations(slide) {
      const animatedElements = Array.from(
        slide.querySelectorAll(".slide-element-inner")
      );

      for (const element of animatedElements) {
        const animation = element.style.animation;
        element.style.animation = "none";
        element.offsetHeight;
        element.style.animation = animation;
      }
    }

    function showSlide(index) {
      if (index < 0 || index >= slides.length) {
        return;
      }

      slides[currentSlideIndex].classList.remove("active");
      currentSlideIndex = index;
      slides[currentSlideIndex].classList.add("active");

      indicator.textContent = currentSlideIndex + 1 + " / " + slides.length;
      replayAnimations(slides[currentSlideIndex]);
    }

    function nextSlide() {
      showSlide(currentSlideIndex + 1);
    }

    function previousSlide() {
      showSlide(currentSlideIndex - 1);
    }

    window.addEventListener("resize", fitStage);
    window.addEventListener("click", nextSlide);

    window.addEventListener("keydown", (event) => {
      if (
        event.key === "ArrowRight" ||
        event.key === " " ||
        event.key === "Enter" ||
        event.key === "PageDown"
      ) {
        event.preventDefault();
        nextSlide();
      }

      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        previousSlide();
      }
    });

    fitStage();

    if (slides[0]) {
      replayAnimations(slides[0]);
    }
  </script>
</body>
</html>`;
}

export function exportProjectAsHtml(project: PresentationProject) {
  const html = createHtmlDocument(project);
  const blob = new Blob([html], {
    type: "text/html;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${project.name || "animify"}.html`;
  link.click();

  URL.revokeObjectURL(url);
}
