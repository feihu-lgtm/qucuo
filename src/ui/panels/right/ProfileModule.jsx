import { useState } from "react";
import { getCompanionForms, companionPortraitUrl } from "../../../domain/rules/companion/portraits.js";
import { activeCompanion, COMPANION_LORE, COMPANION_DESC_FORMS } from "../../../domain/rules/companion/companion.js";
import { getCompanionDescForm, setCompanionDescForm } from "../../../domain/rules/companion/companionForms.js";
import { bodyProfileFilled } from "../../../domain/rules/character/bodyProfile.js";
import { OVERLAY, openOverlay } from "../../../store/uiStore.js";
import { Icon } from "../../primitives/index.js";
import { npcArtUrl } from "../../art/art.js";
import AnimatedNumber from "../../components/AnimatedNumber.jsx";

export default function ProfileModule({ char, exp, pot, playerAvatar, companionState, slForm, setSnowLeopardForm, setSlFormState, slImgErr, setSlImgErr, pearlForm, setPearlForm, setPearlFormState, pearlImgErr, setPearlImgErr, inspectItem, inspecting }) {
  const [, setCompFormTick] = useState(0);
  const [compDescOpen, setCompDescOpen] = useState(false);
  const comp = activeCompanion(companionState);
  const compLore = comp ? COMPANION_LORE[comp.key] : null;
  const compForm = comp ? getCompanionDescForm(comp.key) : "beast";
  const pickCompForm = (formKey) => { if (!comp) return; setCompanionDescForm(comp.key, formKey); setCompFormTick(n => n + 1); };
  // 立绘形态：按伙伴 key 取对应的 forms/当前form/imgErr/setter
  const compForms = comp ? getCompanionForms(comp.key) : null;
  const compFormKey = comp ? (comp.key === "snowLeopard" ? slForm : comp.key === "pearl" ? pearlForm : null) : null;
  const compImgErr = comp ? (comp.key === "snowLeopard" ? slImgErr : comp.key === "pearl" ? pearlImgErr : true) : true;
  const compSetImgErr = comp ? (comp.key === "snowLeopard" ? setSlImgErr : comp.key === "pearl" ? setPearlImgErr : null) : null;
  const compFallbackArt = comp ? npcArtUrl(comp.label) : null;
  const compSrc = comp ? (compForms && !compImgErr ? companionPortraitUrl(comp.key, compFormKey) : compFallbackArt) : null;
  const cycleCompForm = () => {
    if (!comp || !compForms) return;
    const idx = compForms.findIndex(f => f.key === compFormKey);
    const next = compForms[(idx + 1) % compForms.length];
    if (comp.key === "snowLeopard") { setSnowLeopardForm(next.key); setSlFormState(next.key); setSlImgErr(false); }
    else if (comp.key === "pearl") { setPearlForm(next.key); setPearlFormState(next.key); setPearlImgErr(false); }
  };
  const hpCur = char.hp?.[0] ?? 0;
  const hpMax = Math.max(1, char.hp?.[1] ?? 100);
  const hpPct = Math.min(100, Math.max(0, Math.round((hpCur / hpMax) * 100)));
  const bodyTotal = bodyProfileFilled(char.bodyProfile).total;
  return (
    <div className="profile-wrap">
      {/* 玩家一列：头像 + 体貌按钮（体貌从名字旁挪到头像正下方，与队友列对齐） */}
      <div className="profile-portrait-col">
        <div
          onClick={() => openOverlay(OVERLAY.AVATAR_PICKER)}
          title="点击更换头像" className="profile-avatar-card"
        >
          {playerAvatar ? (
            <img src={playerAvatar} alt="" className="profile-avatar-img" />
          ) : (
            <span className="profile-avatar-empty">点击<br/>设置头像</span>
          )}
          <span className="profile-avatar-tag">换像</span>
        </div>
        <span
          onClick={() => openOverlay(OVERLAY.BODY)}
          title="体貌 · 身量体型与身体细节，动作描写和私聊都会照着写" className="profile-body-btn" data-on={Boolean(bodyTotal)}
        >
          <Icon name="体貌" size={12} /> 体貌{bodyTotal ? ` ${bodyTotal}` : ""}
        </span>
      </div>
      {/* 队友一列：当前出战伙伴的头像 + 外貌选择器 */}
      {comp && (
        <div className="profile-portrait-col">
          <div
            onClick={compForms ? cycleCompForm : undefined}
            title={compForms ? `${comp.label} · 点击切换立绘形态` : comp.label} className="profile-companion-card" data-on={Boolean(compForms)}
          >
            {compSrc ? (
              <img src={compSrc} alt={comp.label} className="profile-avatar-img"
                onError={() => { if (compForms && !compImgErr) compSetImgErr?.(true); }} />
            ) : (
              <span className="profile-avatar-empty">{comp.label}立绘<br/>待投放</span>
            )}
            <span className="profile-avatar-tag">{comp.label}</span>
          </div>
          {compLore && (
            <>
              <div className="profile-form-tabs">
                {COMPANION_DESC_FORMS.map(f => (
                  <span key={f.key} onClick={() => pickCompForm(f.key)}
                    title={`注入 AI 的${comp.label}外貌描述：${f.label}`} className="profile-form-tab" data-on={Boolean(compForm === f.key)}>{f.label}</span>
                ))}
              </div>
              <span onClick={() => setCompDescOpen(v => !v)}
                title="展开/收起这段会发给 AI 的外貌描述"
                className="profile-desc-toggle">
                外貌描述 {compDescOpen ? "▴" : "▾"}
              </span>
              {compDescOpen && (
                <div className="profile-desc-box">
                  {compLore.base}{compForm === "human" ? compLore.human : compLore.beast}
                </div>
              )}
            </>
          )}
        </div>
      )}
      <div className="profile-info-col">
        <div className="profile-char-name">{char.name || "无名少侠"}</div>
        <div className="profile-char-sub">{char.gender || "男"}　少侠</div>
        <div className="profile-hp-block">
          <div className="profile-stat-line">
            <span className="profile-stat-label"><Icon name="气血" size={13} /> 气血</span>
            <span className={`profile-stat-num${hpCur <= 30 ? " is-low" : ""}`}><AnimatedNumber value={hpCur} />/{char.hp?.[1] ?? 100}</span>
          </div>
          <div className="night-bar"><div className="night-bar-fill night-bar-fill--accent" style={{ width: `${hpPct}%` }} /></div>
        </div>
        <div className="profile-stat-line">
          <span className="profile-stat-label"><Icon name="经验" size={13} /> 经验 <AnimatedNumber className="profile-val-num" value={exp} /></span>
          <span className="profile-stat-label"><Icon name="潜能" size={13} /> 潜能 <AnimatedNumber className="profile-val-num" value={pot} /></span>
        </div>
        <div className="profile-stat-line">
          <span className="profile-stat-label"><Icon name="银两" size={13} /> 银两 <AnimatedNumber className="profile-val-gold" value={char.money || 0} /> 两</span>
        </div>
        <div className="profile-stat-line">
          <span className="profile-stat-label"><Icon name="信鸽" size={13} /> 信鸽 <span className="profile-val-gold">{char.pigeons || 0}</span> 只</span>
          <span
            onClick={() => inspectItem("pigeon", "信鸽", `现有${char.pigeons || 0}只`, null, { worldLook: true })}
            title="查看：信鸽是什么、能做什么" className="profile-inspect-btn" data-on={Boolean(inspecting === "信鸽")}
          >查看{inspecting === "信鸽" ? "…" : ""}</span>
        </div>
      </div>
    </div>
  );
}
