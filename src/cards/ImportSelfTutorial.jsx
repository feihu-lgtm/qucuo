// 「导入角色卡当自己」入门教程
// ============================================================================
// 开始游戏 →「导入角色卡当自己」进来时先弹这一层，讲清这条流程是干什么的：
// 上传卡 → AI 扫出人物 → 选一位当主角（你主控）→ 其余成为 NPC（驻某地/游走）→
// 设主角（体貌/武学/装备都让 AI 扫）→ 选同行 → 开始。
// 看过一次记进 localStorage，之后不再自动弹；标题栏留一个「教程」随时可重看。

import React from "react";
import { S } from "./ReviewParts.jsx";

export const IMPORT_SELF_TUTORIAL_KEY = "qucuo_import_self_tutorial_seen";

const STEPS = [
  { ic: "①", t: "上传角色卡", d: "把酒馆角色卡（PNG 或 JSON）拖进来，或点着选。卡里的世界书、人物、开场白都会被读出来。" },
  { ic: "②", t: "AI 扫出主要人物", d: "让 AI 通读一遍，认出卡里所有能单独成人的角色，替你分好类。" },
  { ic: "③", t: "选一位当主角", d: "从扫出的人里挑一个当「我自己」——这就是你在江湖里主控的人。也可以选「空白」从头自己捏。" },
  { ic: "④", t: "设置主角", d: "体貌由 AI 从外貌描写里扫出，不用手填；再让 AI 现编初始武学、配初始装备（点装备名能看它的词条）。都可再手改。" },
  { ic: "⑤", t: "其余成为 NPC", d: "卡里其他人可以落进曲措乡当 NPC——驻在某个据点，或在几处之间游走。逐个还能调品阶、招式、随身物。" },
  { ic: "⑥", t: "选同行 · 开始", d: "从入江湖的人里指定一位开局就随队（初始队友），然后开始游戏。" },
];

export default function ImportSelfTutorial({ accent = "#d4a853", onClose }) {
  const shell = {
    position: "absolute", inset: 0, zIndex: 20,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    background: "rgba(6,4,2,.86)", backdropFilter: "blur(3px)",
    fontFamily: "'Noto Serif SC','Songti SC','STSong',serif",
  };
  const card = {
    position: "relative", width: "min(560px, 92vw)", maxHeight: "88%",
    display: "flex", flexDirection: "column", overflow: "hidden",
    background: "#14100a", border: `1px solid ${accent}66`, borderRadius: 0,
    boxShadow: "0 12px 48px rgba(0,0,0,.6)",
  };
  return (
    <div style={shell} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{
          display: "flex", alignItems: "center", gap: 9, padding: "14px 18px",
          borderBottom: `1px solid ${accent}33`,
        }}>
          <img src={S("ui/scroll_ic.webp")} alt="" style={{ width: 22, height: 22, opacity: .9 }} />
          <span style={{ color: "#f0e0c0", fontSize: 16, letterSpacing: 3, textShadow: "0 1px 4px #000" }}>
            导入角色卡当自己
          </span>
        </div>

        <div style={{ padding: "16px 18px", overflowY: "auto" }}>
          <div style={{ fontSize: 12, color: "#c0a86a", lineHeight: 1.8, marginBottom: 14 }}>
            这条流程把一张角色卡变成<b style={{ color: "#e8dcc0" }}>你自己</b>的开局：AI 扫出卡里所有主要人物，
            你挑一位<b style={{ color: accent }}>当主角亲自主控</b>，其余的都能成为江湖里的 NPC。
            体貌、初始武学、装备全交给 AI 扫，你只管挑与改。
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                <span style={{
                  flexShrink: 0, width: 26, height: 26, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, color: accent, border: `1px solid ${accent}77`,
                  background: "rgba(212,168,83,.10)",
                }}>{s.ic}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#e8dcc0", marginBottom: 2 }}>{s.t}</div>
                  <div style={{ fontSize: 11, color: "#8a8270", lineHeight: 1.7 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px 18px", borderTop: `1px solid ${accent}22`, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: 1, fontSize: 10, color: "#8f8a7c" }}>随时可在标题栏「教程」重看这一页。</span>
          <span onClick={onClose}
            style={{
              cursor: "pointer", userSelect: "none", fontSize: 13, padding: "7px 20px", borderRadius: 0,
              color: "#1a1206", fontWeight: 700, letterSpacing: 1,
              background: `linear-gradient(180deg, ${accent}, #a8843f)`,
              border: `1px solid ${accent}`, boxShadow: "0 2px 8px rgba(0,0,0,.4)",
            }}>知道了，开始上传</span>
        </div>
      </div>
    </div>
  );
}
