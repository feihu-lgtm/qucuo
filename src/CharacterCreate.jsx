// 角色创建页：全新开局时，在开场信之前，让玩家填「少侠名讳」+ 选「性别」。
// 藏式 UI，复用开始界面的雪山背景与暖金配色。名讳写入 char.name（替换原「陈狐飞」），
// 性别写入 char.gender（后续注入每轮 user prompt）。
import React, { useState } from "react";
import { ZONE_THEMES } from "./theme.js";

const theme = ZONE_THEMES.village;
const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";

const GENDERS = [
  { value: "男", label: "男" },
  { value: "女", label: "女" },
  { value: "其他", label: "其他（自填）" },
];

export default function CharacterCreate({ onConfirm }) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState("男");
  const [customGender, setCustomGender] = useState("");

  const finalGender = gender === "其他" ? (customGender.trim() || "其他") : gender;
  const canConfirm = name.trim().length > 0;

  const submit = () => {
    if (!canConfirm) return;
    onConfirm({ name: name.trim(), gender: finalGender });
  };

  return (
    <div style={styles.container}>
      <div style={styles.vignette} />
      <div style={styles.card}>
        <div style={styles.title}>初入江湖</div>
        <div style={styles.sub}>—— 报上名号，方好行走曲措乡 ——</div>

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
    backgroundImage: `url('${BASE}start-bg.jpg')`,
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
