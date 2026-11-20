import { useLayoutEffect, useRef } from "react";
import { distributedGap } from "./facePreferences.js";

export default function FaceContent({ face, panelId, tabId, direction, modules, renderModule, editable }) {
  const scrollRef = useRef(null);
  const listRef = useRef(null);
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const list = listRef.current;
    const measure = () => {
      const heights = [...list.children].map(child => child.offsetHeight);
      const gap = distributedGap(scroll.clientHeight - 20, heights);
      list.style.rowGap = `${gap}px`;
    };
    const observer = new ResizeObserver(measure);
    observer.observe(scroll);
    for (const child of list.children) observer.observe(child);
    measure();
    return () => observer.disconnect();
  }, [modules]);
  return (
    <div ref={scrollRef} id={panelId} role="tabpanel" aria-label={face.name || "未命名"} aria-labelledby={tabId}
      className={`face-content ${direction < 0 ? "face-backward" : "face-forward"}`}>
      <div className="face-modules" ref={listRef}>
        {modules.map(id => <section key={id} data-module={id}>{renderModule(id)}</section>)}
        {!modules.length && <p className="face-empty">本面暂无可显示的模块。{editable && "可点「编排」添加。"}</p>}
      </div>
    </div>
  );
}
