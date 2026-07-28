// 角色创建页：全新开局时，在开场信之前，让玩家填「少侠名讳」+ 选「性别」。
// 藏式 UI，复用开始界面的雪山背景与暖金配色。名讳写入 char.name（替换原「陈狐飞」），
// 性别写入 char.gender（后续注入每轮 user prompt）。
import React, { useState } from "react";
import { ZONE_THEMES } from "./theme.js";
import { getPendingPlayerCard, clearPendingPlayerCard } from "./cards/importedRegistry.js";

const theme = ZONE_THEMES.village;
const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";

const GENDERS = [
  { value: "男", label: "男" },
  { value: "女", label: "女" },
  { value: "其他", label: "其他（自填）" },
];

export default function CharacterCreate({ onConfirm }) {
  // 待用主角卡：开始界面入册时若勾了「这张卡当我自己」，卡会存在这里等着。
  // 开局前是唯一能用它的时机——角色一旦创建，再导入就是覆盖了。
  const [pending, setPending] = useState(() => getPendingPlayerCard());
  const [useCard, setUseCard] = useState(() => !!getPendingPlayerCard());
  const [name, setName] = useState(() => getPendingPlayerCard()?.name || "");
  const [gender, setGender] = useState("男");
  const [customGender, setCustomGender] = useState("");

  const finalGender = gender === "其他" ? (customGender.trim() || "其他") : gender;
  const canConfirm = name.trim().length > 0;

  const submit = () => {
    if (!canConfirm) return;
    // 用卡时把体貌与七维一并交出去，由 MudRPG 写进 char 并重算气血。
    // 不管用不用，这张待用卡都要清掉——它是一次性的，留着会在下次新开局时
    // 莫名其妙又冒出来。
    const fromCard = useCard && pending ? pending : null;
    clearPendingPlayerCard();
    onConfirm({ name: name.trim(), gender: finalGender, fromCard });
  };

  const filledCount = pending
    ? Object.values(pending.bodyProfile || {}).filter(v => (v || "").trim()).length
    : 0;

  return (
    <div style={styles.container}>
      <div style={styles.vignette} />
      <div style={styles.card}>
        <div style={styles.title}>初入江湖</div>
        <div style={styles.sub}>—— 报上名号，方好行走曲措乡 ——</div>

        {pending && (
          <div style={styles.cardBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 15 }}>🧾</span>
              <span style={{ color: "#f0e0c0", fontSize: 13, flex: 1 }}>
                有一张入册待用的角色卡
              </span>
              <span
                onClick={() => { clearPendingPlayerCard(); setPending(null); setUseCard(false); }}
                title="弃用这张卡，从头自己填"
                style={{ cursor: "pointer", fontSize: 11, color: "#8a8270" }}
              >弃用</span>
            </div>
            <div style={{ fontSize: 11.5, color: "#c8bfa0", lineHeight: 1.8 }}>
              {pending.name ? `名讳「${pending.name}」 · ` : ""}体貌 {filledCount}/7 项
              {pending.special ? ` · 七维已录` : ""}
            </div>
            <div
              onClick={() => {
                const next = !useCard;
                setUseCard(next);
                if (next && pending.name) setName(pending.name);
              }}
              style={{
                marginTop: 8, cursor: "pointer", fontSize: 12,
                color: useCard ? theme.accent : "#8a8270",
              }}
            >
              {useCard ? "◉" : "○"} 用这张卡的设定开局
            </div>
          </div>
        )}

        <label style={styles.field}>
          <span style={styles.fieldLabel}>少侠名讳</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 12))}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="请输入你的名字（最多 12 字）"
            style={styles.input}
          />
        </label>

        <label style={styles.field}>
          <span style={styles.fieldLabel}>性别</span>
          <select value={gender} onChange={(e) => setGender(e.target.value)} style={styles.select}>
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value} style={{ background: "#1a140c" }}>{g.label}</option>
            ))}
          </select>
        </label>

        {gender === "其他" && (
          <label style={styles.field}>
            <span style={styles.fieldLabel}>自定义</span>
            <input
              value={customGender}
              onChange={(e) => setCustomGender(e.target.value.slice(0, 8))}
              placeholder="填写你认同的称谓（可留空）"
              style={styles.input}
            />
          </label>
        )}

        <div
          onClick={submit}
          style={{ ...styles.confirm, opacity: canConfirm ? 1 : 0.4, cursor: canConfirm ? "pointer" : "not-allowed" }}
        >
          踏入曲措乡 ▸
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed", inset: 0, overflow: "hidden",
    backgroundImage: `url('${BASE}start-bg.webp')`,
    backgroundSize: "cover", backgroundPosition: "center",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Noto Serif SC','Songti SC','STSong',serif",
  },
  vignette: {
    position: "absolute", inset: 0, pointerEvents: "none",
    background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.6) 100%)",
  },
  card: {
    position: "relative", zIndex: 1,
    width: "min(420px, 88vw)",
    background: "rgba(16,12,8,0.82)",
    border: `1.5px solid ${theme.accent}`,
    borderRadius: 10,
    padding: "36px 40px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
    backdropFilter: "blur(3px)",
  },
  title: {
    color: "#f0e0c0", fontSize: "26px", fontWeight: "bold",
    textAlign: "center", letterSpacing: "6px", marginBottom: 8,
    textShadow: "0 2px 10px rgba(0,0,0,0.7)",
  },
  sub: {
    color: theme.accent, fontSize: "12px", textAlign: "center",
    letterSpacing: "2px", opacity: 0.85, marginBottom: 30,
  },
  cardBox: {
    marginBottom: 20, padding: "12px 14px", borderRadius: 6,
    background: "rgba(212,168,83,.08)",
    border: `1px solid ${theme.accent}55`,
  },
  field: { display: "block", marginBottom: 20 },
  fieldLabel: {
    display: "block", color: "#d8c8a0", fontSize: "13px",
    letterSpacing: "2px", marginBottom: 8,
  },
  input: {
    width: "100%", boxSizing: "border-box",
    background: "rgba(0,0,0,0.4)", border: `1px solid ${theme.border || "#4a3a1a"}`,
    borderRadius: 5, padding: "10px 14px",
    color: "#f0e8d8", fontSize: "15px", outline: "none",
    fontFamily: "inherit",
  },
  select: {
    width: "100%", boxSizing: "border-box",
    background: "rgba(0,0,0,0.4)", border: `1px solid ${theme.border || "#4a3a1a"}`,
    borderRadius: 5, padding: "10px 14px",
    color: "#f0e8d8", fontSize: "15px", outline: "none",
    fontFamily: "inherit", cursor: "pointer",
  },
  confirm: {
    marginTop: 14, textAlign: "center",
    background: `linear-gradient(180deg, ${theme.accent}, #8a6a2a)`,
    color: "#1a140c", fontSize: "16px", fontWeight: "bold",
    letterSpacing: "3px", padding: "13px 0", borderRadius: 6,
    userSelect: "none", transition: "opacity 0.2s",
  },
};
