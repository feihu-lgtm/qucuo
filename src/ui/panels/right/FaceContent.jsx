import { useLayoutEffect, useRef } from "react";
import { distributedGap } from "./facePreferences.js";

export default function FaceContent({ face, direction, modules, moduleProps }) {
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
    <div ref={scrollRef} id={`right-face-${face.id}`} role="tabpanel" aria-label={face.name || "未命名"}
      className={`right-face-content ${direction < 0 ? "right-face-backward" : "right-face-forward"}`}>
      <div className="right-face-modules" ref={listRef}>
        {modules.map(entry => {
          const Component = entry.Component;
          return <section key={entry.id} data-module={entry.id}><Component {...moduleProps} /></section>;
        })}
        {!modules.length && <p className="right-face-empty">本面暂无可显示的模块，可点「编排」添加。</p>}
      </div>
    </div>
  );
}
