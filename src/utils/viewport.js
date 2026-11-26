// 设备判断的唯一来源（路线图 U5）。
// ---------------------------------------------------------------------------
// 断点表写在 tokens.css 顶部注释与 --bp-* 变量里；这里的常量必须与之一致，
// viewport.test.js 会核对。JS 里任何地方要问"是不是手机""是不是竖屏手机"，
// 一律调这里（UI 组件用 ui/hooks/useViewport.js 包好的 hook），不再各写
// innerWidth < 768 或 matchMedia。store / app 层不能依赖 ui，所以纯函数放在 utils。

// 手机：视口宽度 ≤ 767px（与 mobile.css 的 @media (max-width: 767px) 一致）。
export const PHONE_MAX_WIDTH = 767;

export function isMobileWidth(width) {
  return typeof width === "number" && width <= PHONE_MAX_WIDTH;
}

export function readViewport() {
  if (typeof window === "undefined") return { width: 0, height: 0, isMobile: false, isPortraitPhone: false };
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isMobile = isMobileWidth(width);
  return { width, height, isMobile, isPortraitPhone: isMobile && height > width };
}

export function isMobileViewport() {
  return readViewport().isMobile;
}

export function subscribeViewport(onChange) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}
