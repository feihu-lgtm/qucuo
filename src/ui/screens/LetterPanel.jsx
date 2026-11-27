import React, { useState } from "react";
import { Overlay, Header, Btn } from "./buildings/common.jsx";
import { useGameStore } from "../../store/gameStore.js";
import { closeOverlay, OVERLAY } from "../../store/uiStore.js";
import { setInputCapsule } from "../../store/sessionUiStore.js";
import NpcAvatar from "../components/NpcAvatar.jsx";

// 「信」面板——翻历史来信：列表 → 正文；回信沿用飞鸽路径（输入条进寄信模式）。
const EMPTY_LETTERS = [];

export default function LetterPanel({ onClose, inline }) {
  // 空档要给稳定引用——每次新 [] 会让 zustand 选择器重渲染不止。
  const letters = useGameStore((s) => s.varTree?.世界?.来信箱 || EMPTY_LETTERS);
  const pigeons = useGameStore((s) => s.char?.pigeons || 0);
  const [openId, setOpenId] = useState(null);
  const open = letters.find((l) => l.id === openId) || letters[0];

  const reply = (npcName) => {
    if (pigeons <= 0) return;
    setInputCapsule({ kind: "pigeon", name: npcName });
    closeOverlay(OVERLAY.LETTERS);
    onClose?.();
  };

  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name={`信件${letters.length ? `（${letters.length}）` : ""} · 信鸽 ${pigeons} 只`} onClose={onClose} />
      <div className="mobile-overlay-content" style={{ padding: 16 }}>
        {!letters.length && (
          <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)" }}>
            还没有收到过信。与你结识的人，想起你时便会托鸽子捎话来。
          </div>
        )}
        {letters.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {letters.map((l) => (
                <div key={l.id}
                  onClick={() => setOpenId(l.id)}
                  className="letter-list-row" data-on={Boolean(open?.id === l.id)}>
                  <NpcAvatar name={l.npcName} size="sm" />
                  <span className="letter-list-sender" data-on={Boolean(open?.id === l.id)}>
                    ✉ {l.npcName}
                  </span>
                  {!l.read && <span className="letter-list-unread">未读</span>}
                  <span className="letter-list-preview">{l.content}</span>
                </div>
              ))}
            </div>
            {open && (
              <div className="letter-detail-box">
                <div className="letter-detail-head">
                  <span className="letter-detail-sender">
                    <NpcAvatar name={open.npcName} size="md" />
                    <span>「{open.npcName} 来信」</span>
                  </span>
                  <Btn
                    label={pigeons > 0 ? "回信" : "回信（缺信鸽）"}
                    disabled={pigeons <= 0}
                    onClick={() => reply(open.npcName)}
                  />
                </div>
                <div className="letter-detail-body">{open.content}</div>
                {pigeons <= 0 && (
                  <div className="letter-detail-hint">没有信鸽可回——来信时鸽子会留下一只，或去驿站买。</div>
                )}
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: 14, textAlign: "right" }}>
          <Btn label="关闭" onClick={onClose} secondary />
        </div>
      </div>
    </Overlay>
  );
}
