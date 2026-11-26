import { chromeBtn } from "../../utils/theme.js";

export default function MobileTabBar({ theme, column, onSelect, leftFaces, rightFaces }) {
  return (
    <nav className="mobile-tab-bar" aria-label="界面栏目" style={{ borderTop: `1px solid ${theme.border}`, background: theme.bg }}>
      {[["left", "左", leftFaces], ["center", "中"], ["right", "右", rightFaces]].map(([id, label, faces]) => {
        const text = faces ? `${label} ${faces.index + 1}/${faces.count}` : label;
        const description = faces ? `${text} · ${faces.face.name}` : "中 · 叙事";
        return <button key={id} type="button" aria-label={description} title={description}
          aria-current={column === id ? "page" : undefined} onClick={() => onSelect(id)}
          style={{ ...chromeBtn(theme, { active: column === id }), minWidth: 44, height: 44, fontFamily: "inherit" }}>{text}</button>;
      })}
    </nav>
  );
}
