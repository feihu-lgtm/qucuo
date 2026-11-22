// 角色创建页：全新开局时，在开场信之前，让玩家填「少侠名讳」+ 选「性别」。
// 藏式 UI，复用开始界面的雪山背景与暖金配色。名讳写入 char.name（替换原「陈狐飞」），
// 性别写入 char.gender（后续注入每轮 user prompt）。
import React, { useState } from "react";
import { ZONE_THEMES } from "../../utils/theme.js";
import { getPendingPlayerCard, clearPendingPlayerCard, clearPendingStarterCompanion } from "../../domain/rules/cards/importedRegistry.js";
import { adjustSpecial, baseSpecial, drawStarterSkills, remainingSpecialPoints, randomizeSpecial } from "../../domain/rules/character/starterBuild.js";
import StatAllocator from "./StatAllocator.jsx";
import StarterSkillCards from "./StarterSkillCards.jsx";
import PortraitBodyStep from "./PortraitBodyStep.jsx";
import { emptyBodyProfile } from "../../domain/rules/character/bodyProfile.js";
import {
  applyBodyPreset,
  defaultPortraitIdForGender,
  getPortraitPreset,
  portraitPresetUrl,
} from "../../domain/rules/character/bodyPresets.js";

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
  const [step, setStep] = useState("identity");
  const [selectedPortraitId, setSelectedPortraitId] = useState("male");
  const [portraitTouched, setPortraitTouched] = useState(false);
  const [bodyProfile, setBodyProfile] = useState(() =>
    applyBodyPreset(emptyBodyProfile(), getPortraitPreset("male"), { includeIntimate: false }),
  );
  const [special, setSpecial] = useState(baseSpecial);
  const [starterChoices, setStarterChoices] = useState([]);
  const [starterSkillId, setStarterSkillId] = useState(null);
  const [rerolls, setRerolls] = useState(3);

  const finalGender = gender === "其他" ? (customGender.trim() || "其他") : gender;
  const canConfirm = name.trim().length > 0;

  const submitIdentity = () => {
    if (!canConfirm) return;
    const fromCard = useCard && pending ? pending : null;
    clearPendingPlayerCard();
    if (fromCard) {
      onConfirm({ name: name.trim(), gender: finalGender, fromCard, special: undefined, starterSkillId: undefined });
      return;
    }
    if (!portraitTouched) {
      const defId = defaultPortraitIdForGender(gender);
      setSelectedPortraitId(defId);
      setBodyProfile(applyBodyPreset(emptyBodyProfile(), getPortraitPreset(defId), { includeIntimate: false }));
    }
    setStep("appearance");
  };

  const handleSelectPortrait = (preset, { includeIntimate = false } = {}) => {
    setPortraitTouched(true);
    setSelectedPortraitId(preset.id);
    setBodyProfile((prev) => applyBodyPreset(prev, preset, { includeIntimate }));
  };

  const continueToStats = () => {
    setStep("stats");
  };

  const continueToSkills = () => {
    if (remainingSpecialPoints(special) !== 0) return;
    setStarterChoices(drawStarterSkills());
    setStarterSkillId(null);
    setStep("skills");
  };

  const rerollSkills = () => {
    if (rerolls <= 0) return;
    setStarterChoices(drawStarterSkills(undefined, starterChoices.map((skill) => skill.id)));
    setStarterSkillId(null);
    setRerolls((count) => count - 1);
  };

  const confirmBuild = () => {
    if (!starterSkillId) return;
    const portrait = getPortraitPreset(selectedPortraitId);
    onConfirm({
      name: name.trim(),
      gender: finalGender,
      fromCard: null,
      special,
      starterSkillId,
      bodyProfile,
      portraitUrl: portraitPresetUrl(portrait, BASE),
    });
  };

  const pubFilled = pending
    ? Object.values(pending.bodyProfile || {}).filter(v => (v || "").trim()).length
    : 0;
  const privFilled = pending
    ? Object.values(pending.bodyProfilePrivate || {}).filter(v => (v || "").trim()).length
    : 0;

  return (
    <div className="character-create-root" style={styles.container}>
      <div style={styles.vignette} />
      <div
        className={`character-create-card${step === "appearance" ? " character-create-card--wide" : ""}`}
        style={{ ...styles.card, ...(step === "appearance" ? styles.cardWide : null) }}
      >
        <div className="character-create-title" style={styles.title}>初入江湖</div>
        <div className="character-create-sub" style={styles.sub}>—— 报上名号，方好行走曲措乡 ——</div>

        {pending && (
          <div style={styles.cardBox}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 15 }}>🧾</span>
              <span style={{ color: "var(--create-title)", fontSize: 13, flex: 1 }}>
                有一张入册待用的角色卡
              </span>
              <span
                onClick={() => { clearPendingPlayerCard(); clearPendingStarterCompanion(); setPending(null); setUseCard(false); }}
                title="弃用这张卡，从头自己填"
                style={{ cursor: "pointer", fontSize: 11, color: "var(--muted)" }}
              >弃用</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text)", lineHeight: 1.8 }}>
              {pending.name ? `名讳「${pending.name}」 · ` : ""}体貌公开 {pubFilled}/7 项 · 私密 {privFilled}/5 项
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
                color: useCard ? theme.accent : "var(--muted)",
              }}
            >
              {useCard ? "◉" : "○"} 用这张卡的设定开局
            </div>
          </div>
        )}

        {step === "identity" && (
          <>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>少侠名讳</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 12))}
                onKeyDown={(e) => { if (e.key === "Enter") submitIdentity(); }}
                placeholder="请输入你的名字（最多 12 字）"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.fieldLabel}>性别</span>
              <select value={gender} onChange={(e) => setGender(e.target.value)} style={styles.select}>
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value} style={{ background: "var(--create-dark)" }}>{g.label}</option>
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

            <button
              type="button"
              onClick={submitIdentity}
              disabled={!canConfirm}
              style={{ ...styles.confirm, opacity: canConfirm ? 1 : 0.4, cursor: canConfirm ? "pointer" : "not-allowed" }}
            >
              {useCard && pending ? "踏入曲措乡 ▸" : "下一步：选立绘与体貌 ▸"}
            </button>
          </>
        )}

        {step === "appearance" && (
          <PortraitBodyStep
            base={BASE}
            selectedPortraitId={selectedPortraitId}
            bodyProfile={bodyProfile}
            onSelectPortrait={handleSelectPortrait}
            onBodyChange={setBodyProfile}
            onBack={() => setStep("identity")}
            onContinue={continueToStats}
            theme={theme}
          />
        )}

        {step === "stats" && (
          <StatAllocator
            special={special}
            remaining={remainingSpecialPoints(special)}
            onAdjust={(key, delta) => setSpecial((current) => adjustSpecial(current, key, delta))}
            onRandomize={() => setSpecial(randomizeSpecial())}
            onContinue={continueToSkills}
            theme={theme}
          />
        )}

        {step === "skills" && (
          <StarterSkillCards
            skills={starterChoices}
            selectedId={starterSkillId}
            rerolls={rerolls}
            onSelect={setStarterSkillId}
            onReroll={rerollSkills}
            onConfirm={confirmBuild}
            theme={theme}
          />
        )}
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
    borderRadius: 0,
    padding: "36px 40px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
    backdropFilter: "blur(3px)",
  },
  cardWide: {
    width: "min(680px, 92vw)",
    padding: "24px 28px",
  },
  title: {
    color: "var(--create-title)", fontSize: "26px", fontWeight: "bold",
    textAlign: "center", letterSpacing: "6px", marginBottom: 8,
    textShadow: "0 2px 10px rgba(0,0,0,0.7)",
  },
  sub: {
    color: theme.accent, fontSize: "12px", textAlign: "center",
    letterSpacing: "2px", opacity: 0.85, marginBottom: 30,
  },
  cardBox: {
    marginBottom: 20, padding: "12px 14px", borderRadius: 0,
    background: "rgba(212,168,83,.08)",
    border: `1px solid ${theme.accent}55`,
  },
  field: { display: "block", marginBottom: 20 },
  fieldLabel: {
    display: "block", color: "var(--ink-tan)", fontSize: "13px",
    letterSpacing: "2px", marginBottom: 8,
  },
  input: {
    width: "100%", boxSizing: "border-box",
    background: "rgba(0,0,0,0.4)", border: `1px solid ${theme.border || "var(--gold-deep)"}`,
    borderRadius: 0, padding: "10px 14px",
    color: "var(--create-input-text)", fontSize: "15px", outline: "none",
    fontFamily: "inherit",
  },
  select: {
    width: "100%", boxSizing: "border-box",
    background: "rgba(0,0,0,0.4)", border: `1px solid ${theme.border || "var(--gold-deep)"}`,
    borderRadius: 0, padding: "10px 14px",
    color: "var(--create-input-text)", fontSize: "15px", outline: "none",
    fontFamily: "inherit", cursor: "pointer",
  },
  confirm: {
    width: "100%", border: "none", marginTop: 14, textAlign: "center",
    background: `linear-gradient(180deg, ${theme.accent}, var(--create-button-bottom))`,
    color: "var(--create-dark)", fontSize: "16px", fontWeight: "bold",
    letterSpacing: "3px", padding: "13px 0", borderRadius: 0,
    userSelect: "none", transition: "opacity 0.2s",
  },
};
