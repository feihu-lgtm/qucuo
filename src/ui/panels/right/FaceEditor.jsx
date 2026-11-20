import { chromeBtn } from "../../theme.js";
import {
  MODULE_LABELS, MAX_FACES, defaultFacePreferences, renameFace,
  toggleModule, moveModule, addFace, removeFace,
} from "./facePreferences.js";

export default function FaceEditor({ preferences, setPreferences, theme }) {
  const face = preferences.faces[preferences.currentIndex];
  const update = operation => setPreferences(previous => operation(previous));
  const button = (label, action, disabled = false) => (
    <button type="button" style={chromeBtn(theme)} disabled={disabled} onClick={action}>{label}</button>
  );
  return (
    <section className="right-face-editor" aria-label="编排当前面" style={{ borderColor: theme.border }}>
      <label className="right-face-name">面名
        <input aria-label="面名" maxLength={12} value={face.name}
          style={{ color: theme.text, background: theme.bgPanel, borderColor: theme.border }}
          onChange={event => update(state => renameFace(state, event.target.value))}
          onBlur={() => { if (!face.name.trim()) update(state => renameFace(state, "未命名")); }} />
      </label>
      <div className="right-face-editor-actions">
        {button("添加面", () => update(addFace), preferences.faces.length >= MAX_FACES)}
        {button("删除此面", () => update(removeFace), preferences.faces.length <= 1)}
        {button("恢复默认", () => setPreferences(defaultFacePreferences()))}
      </div>
      <div className="right-face-module-list">
        {[...face.modules, ...Object.keys(MODULE_LABELS).filter(id => !face.modules.includes(id))].map(id => {
          const position = face.modules.indexOf(id);
          return (
            <div key={id} className="right-face-module-option">
              <label><input type="checkbox" checked={position >= 0}
                onChange={() => update(state => toggleModule(state, id))} />{MODULE_LABELS[id]}</label>
              {position >= 0 && <>
                <button type="button" style={chromeBtn(theme)} aria-label={`上移${MODULE_LABELS[id]}`}
                  disabled={position === 0} onClick={() => update(state => moveModule(state, id, -1))}>↑</button>
                <button type="button" style={chromeBtn(theme)} aria-label={`下移${MODULE_LABELS[id]}`}
                  disabled={position === face.modules.length - 1} onClick={() => update(state => moveModule(state, id, 1))}>↓</button>
              </>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
