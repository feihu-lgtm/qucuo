import { Button } from "../../primitives/index.js";

export default function FaceEditor({ faces, theme }) {
  const { preferences, face, availableModules, minFaces, maxFaces } = faces;
  const labels = Object.fromEntries(availableModules.map(module => [module.id, module.label]));
  const button = (label, action, disabled = false) => (
    <Button variant="chrome" type="button" disabled={disabled} onClick={action}>{label}</Button>
  );
  return (
    <section className="face-editor" aria-label="编排当前面" style={{ borderColor: theme.border }}>
      <label className="face-name">面名
        <input aria-label="面名" maxLength={12} value={face.name}
          style={{ color: theme.text, background: theme.bgPanel, borderColor: theme.border }}
          onChange={event => faces.rename(event.target.value)}
          onBlur={() => { if (!face.name.trim()) faces.rename("未命名"); }} />
      </label>
      <div className="face-editor-actions">
        {button("添加面", faces.add, preferences.faces.length >= maxFaces)}
        {button("删除此面", faces.remove, preferences.faces.length <= minFaces)}
        {button("恢复默认", faces.reset)}
      </div>
      <div className="face-module-list">
        {[...face.modules, ...availableModules.map(module => module.id).filter(id => !face.modules.includes(id))].map(id => {
          const position = face.modules.indexOf(id);
          return (
            <div key={id} className="face-module-option">
              <label><input type="checkbox" checked={position >= 0}
                onChange={() => faces.toggleModule(id)} />{labels[id]}</label>
              {position >= 0 && <>
                <Button variant="chrome" type="button" aria-label={`上移${labels[id]}`}
                  disabled={position === 0} onClick={() => faces.moveModule(id, -1)}>↑</Button>
                <Button variant="chrome" type="button" aria-label={`下移${labels[id]}`}
                  disabled={position === face.modules.length - 1} onClick={() => faces.moveModule(id, 1)}>↓</Button>
              </>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
