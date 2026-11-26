// 弹窗栈与焦点锁定的纯逻辑——ModalShell 用它判断"谁在最上面"。
// ---------------------------------------------------------------------------
// 多个弹窗可以同时挂着（人物页上再开二级弹窗、设置里再开版本历史）。按 Esc
// 只应关掉最上面那一个，所以每个 ModalShell 挂载时压栈、卸载时出栈，键盘事件
// 只交给栈顶处理。这里不碰 DOM，便于在 node 环境里单测。

const stack = [];
let seq = 0;

export function nextModalId() {
  seq += 1;
  return `modal-${seq}`;
}

export function pushModal(id) {
  if (!stack.includes(id)) stack.push(id);
}

export function popModal(id) {
  const index = stack.lastIndexOf(id);
  if (index !== -1) stack.splice(index, 1);
}

export function isTopModal(id) {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

export function modalStackSnapshot() {
  return [...stack];
}

// 只供测试复位用。
export function resetModalStack() {
  stack.length = 0;
}

// Esc 是否应当关闭弹窗：输入法组字时按 Esc 是取消候选词，不能当成关闭。
// isComposing 是标准字段；keyCode 229 是部分浏览器（含旧版 Safari）组字期间的占位码。
export function isCloseKey(event) {
  if (!event || event.key !== "Escape") return false;
  if (event.isComposing || event.keyCode === 229) return false;
  return true;
}

// 焦点锁定：Tab 走到最后一个可聚焦元素后回到第一个，Shift+Tab 反之。
// 返回需要转去的下标；返回 -1 表示交给浏览器默认行为。
export function wrapFocusIndex(count, activeIndex, shiftKey) {
  if (count <= 0) return -1;
  if (activeIndex === -1) return shiftKey ? count - 1 : 0;
  if (shiftKey && activeIndex === 0) return count - 1;
  if (!shiftKey && activeIndex === count - 1) return 0;
  return -1;
}

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=\"hidden\"])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])",
].join(",");

// z-index 档位：取值写在 tokens.css 的 --z-*，这里只列合法名字。
export const MODAL_LAYERS = ["hud", "float", "float-high", "map", "building", "screen", "screen-high", "dialog", "top"];

export function normalizeLayer(layer) {
  return MODAL_LAYERS.includes(layer) ? layer : "dialog";
}
