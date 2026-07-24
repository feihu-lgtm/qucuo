// 弹窗遮罩"点击关闭"的正确判定
// ---------------------------------------------------------------------------
// 背景（bug 复盘）：全项目 29 处弹窗都用同一种写法——
//   外层遮罩 onClick={onClose}，内层弹窗主体 onClick={e => e.stopPropagation()}
// 这个写法在"单纯点一下"的情况下没问题，但有个经典陷阱：浏览器的 click 事件
// 只看 mouseup 落点，不管 mousedown 起点在哪。如果玩家在弹窗内的输入框/文本
// 区域选中文字（比如复制粘贴时拖拽鼠标），手一抖把鼠标拖出了弹窗主体范围、
// 松手时已经在遮罩区域——这次 mousedown+mouseup 依然会被浏览器合成一个
// click 事件，而这次 click 的 target 就是遮罩本身（不是弹窗内部再冒泡出来的，
// stopPropagation 完全挡不住这种情况）。表现就是"复制粘贴/选字选着选着弹窗
// 就自己关了"。
//
// 正确判定：只有 mousedown 和 mouseup 都发生在遮罩本身（不是从弹窗内部拖出来
// 的）时，才真正触发关闭。用法：
//
//   const closeGuard = useOverlayCloseGuard(onClose);
//   <div style={{...}} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
//     <div onClick={e => e.stopPropagation()}>...</div>
//   </div>
//
// 不需要 useState/useEffect，用一个 ref 记录 mousedown 起点即可，纯函数式。

import { useRef, useCallback } from "react";

export function useOverlayCloseGuard(onClose) {
  const downOnSelfRef = useRef(false);

  const onMouseDown = useCallback((e) => {
    // 只有 mousedown 事件的 target 就是遮罩本身（e.target === e.currentTarget）
    // 才标记"这次按下是从遮罩开始的"；如果 mousedown 发生在弹窗内部子元素上，
    // 这里不会被触发到（inner 那层没绑 onMouseDown，事件会在 inner 处理完，
    // 但仍会冒泡到这里——所以要用 target === currentTarget 精确排除）。
    downOnSelfRef.current = e.target === e.currentTarget;
  }, []);

  const onClick = useCallback((e) => {
    // 双重确认：mousedown 起点在遮罩本身 + click 落点也在遮罩本身，
    // 两者都满足才是真正的"点击遮罩关闭"，而不是"从弹窗内部拖拽出来的误触"。
    if (downOnSelfRef.current && e.target === e.currentTarget) {
      onClose();
    }
    downOnSelfRef.current = false;
  }, [onClose]);

  return { onMouseDown, onClick };
}
