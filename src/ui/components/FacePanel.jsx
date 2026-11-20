import { useEffect, useId, useRef, useState } from "react";
import { chromeBtn } from "../theme.js";
import FaceContent from "./faces/FaceContent.jsx";
import FaceEditor from "./faces/FaceEditor.jsx";
import useFaceNavigation from "./faces/useFaceNavigation.js";
import "./faces/faces.css";

const visible = () => true;
const unblocked = () => false;

export default function FacePanel({ faces, theme, renderModule, isMobile = false, swipe = true,
  isModuleVisible = visible, isKeyboardBlocked = unblocked, label = "面板", className = "" }) {
  const [editing, setEditing] = useState(false);
  const contentRef = useRef(null);
  const tabsRef = useRef(null);
  const instanceId = useId();
  const { preferences, face, direction, editable, enableKeyboard, rotate, select } = faces;
  const panelId = `${instanceId}-${face.id}`;
  const modules = face.modules.filter(isModuleVisible);
  useEffect(() => {
    tabsRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [preferences.currentIndex]);
  useFaceNavigation({ isMobile, editing, contentRef, rotate, enableKeyboard, isKeyboardBlocked, swipe });
  return (
    <div className={`face-panel ${className}`}>
      <nav className="face-bar" aria-label={`${label}面切换`} style={{ borderColor: theme.border }}>
        <div ref={tabsRef} className="face-tabs" role="tablist" aria-label={`${label}各面`}>
          {preferences.faces.map((item, index) => (
            <button key={item.id} id={`${instanceId}-tab-${item.id}`} type="button" role="tab"
              aria-selected={index === preferences.currentIndex} aria-controls={`${instanceId}-${item.id}`}
              style={chromeBtn(theme, { active: index === preferences.currentIndex })}
              onClick={() => select(index)}>{item.name || "未命名"}</button>
          ))}
        </div>
        <div className="face-controls">
          <button type="button" aria-label="上一面" style={chromeBtn(theme)} onClick={() => rotate(-1)}>◀</button>
          <button type="button" aria-label="下一面" style={chromeBtn(theme)} onClick={() => rotate(1)}>▶</button>
          {editable && <button type="button" aria-expanded={editing} style={chromeBtn(theme, { active: editing })}
            onClick={() => setEditing(value => !value)}>编排</button>}
        </div>
      </nav>
      {editable && editing && <FaceEditor faces={faces} theme={theme} />}
      <div className="face-stage" ref={contentRef} style={{ touchAction: swipe ? "pan-y pinch-zoom" : "auto" }}>
        <FaceContent key={face.id} face={face} panelId={panelId} tabId={`${instanceId}-tab-${face.id}`}
          direction={direction} modules={modules} renderModule={renderModule} editable={editable} />
      </div>
    </div>
  );
}
