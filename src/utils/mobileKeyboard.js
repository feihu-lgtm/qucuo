export function isMobileKeyboardOpen({ isMobile, isInputFocused, viewportHeight, innerHeight }) {
  return Boolean(
    isMobile
    && isInputFocused
    && Number.isFinite(viewportHeight)
    && viewportHeight < innerHeight - 120,
  );
}
