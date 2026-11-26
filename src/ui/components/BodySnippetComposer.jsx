import React, { useState } from "react";

export default function BodySnippetComposer({ groups = [], onAppend, bodyProfile, onBodyChange }) {
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
  const group = groups.find((item) => item.id === groupId) || groups[0];
  if (!group) return null;
  const current = bodyProfile?.[group.field] || "";

  return (
    <div className="body-snippet-composer">
      <div className="body-snippet-title">逐条拼凑描写（点击逐句拼入对应栏，可直接叠加组合）</div>
      <div className="body-snippet-tabs">
        {groups.map((item) => (
          <button
            key={item.id}
            type="button"
            className="body-snippet-tab"
            data-on={item.id === group.id}
            onClick={() => setGroupId(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="body-snippet-list">
        {group.items.map((text) => {
          const picked = current.includes(text);
          return (
            <button
              key={text}
              type="button"
              className="body-snippet-chip"
              data-picked={picked}
              onClick={() => onBodyChange({
                ...bodyProfile,
                [group.field]: onAppend ? onAppend(current, text) : text,
              })}
            >
              {picked ? "✓ " : "+ "}{text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
