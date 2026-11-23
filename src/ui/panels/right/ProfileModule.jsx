import { useState } from "react";
import { bar } from "../../../utils/mudHelpers.js";
import { getCompanionForms, companionPortraitUrl } from "../../../domain/rules/companion/portraits.js";
import { activeCompanion, COMPANION_LORE, COMPANION_DESC_FORMS } from "../../../domain/rules/companion/companion.js";
import { getCompanionDescForm, setCompanionDescForm } from "../../../domain/rules/companion/companionForms.js";
import { bodyProfileFilled } from "../../../domain/rules/character/bodyProfile.js";
import { OVERLAY, openOverlay } from "../../../store/uiStore.js";

export default function ProfileModule({ zoneTheme, char, exp, pot, playerAvatar, companionState, slForm, setSnowLeopardForm, setSlFormState, slImgErr, setSlImgErr, pearlForm, setPearlForm, setPearlFormState, pearlImgErr, setPearlImgErr, inspectItem, inspecting }) {
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
  const cycleCompForm = () => {
    if (!comp || !compForms) return;
    const idx = compForms.findIndex(f => f.key === compFormKey);
    const next = compForms[(idx + 1) % compForms.length];
    if (comp.key === "snowLeopard") { setSnowLeopardForm(next.key); setSlFormState(next.key); setSlImgErr(false); }
    else if (comp.key === "pearl") { setPearlForm(next.key); setPearlFormState(next.key); setPearlImgErr(false); }
  };
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
      {/* 玩家一列：头像 + 体貌按钮（体貌从名字旁挪到头像正下方，与队友列对齐） */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, width: 90 }}>
        <div
          onClick={() => openOverlay(OVERLAY.AVATAR_PICKER)}
          title="点击更换头像"
          style={{
            width: 90, aspectRatio: "2/3", borderRadius: 0, overflow: "hidden",
            border: `1px solid ${zoneTheme.border}`, background: "var(--bg-panel)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
          }}
        >
          {playerAvatar ? (
            <img src={playerAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ color: zoneTheme.textDim, fontSize: "10px", textAlign: "center", lineHeight: 1.6 }}>点击<br/>设置头像</span>
          )}
          <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, fontSize: "9px", textAlign: "center", color: "var(--paper)", background: "rgba(0,0,0,0.55)", padding: "1px 0" }}>换像</span>
        </div>
        <span
          onClick={() => openOverlay(OVERLAY.BODY)}
          title="体貌 · 身量体型与身体细节，动作描写和私聊都会照着写"
          style={{
            cursor: "pointer", fontSize: "10px", padding: "1px 6px", borderRadius: 0,
            border: `1px solid ${zoneTheme.border}`, whiteSpace: "nowrap",
            color: bodyProfileFilled(char.bodyProfile).total ? zoneTheme.accent : zoneTheme.textDim,
          }}
        >
          ◈ 体貌{bodyProfileFilled(char.bodyProfile).total ? ` ${bodyProfileFilled(char.bodyProfile).total}` : ""}
        </span>
      </div>
      {/* 队友一列：当前出战伙伴的头像 + 外貌选择器（兽形/人形描述，主要给雪豹/小马可切）。
          就一个队友栏位，头像随出战伙伴变——雪豹/明日香/珍珠各显各的。 */}
      {comp && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, width: 90 }}>
          <div
            onClick={compForms ? cycleCompForm : undefined}
            title={compForms ? `${comp.label} · 点击切换立绘形态` : comp.label}
            style={{
              width: 90, aspectRatio: "2/3", borderRadius: 0, overflow: "hidden",
              border: `1px solid ${zoneTheme.border}`, background: "var(--bg-panel)",
              cursor: compForms ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
            }}
          >
            {compForms && !compImgErr ? (
              <img src={companionPortraitUrl(comp.key, compFormKey)} alt={comp.label} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={() => compSetImgErr?.(true)} />
            ) : (
              <span style={{ color: zoneTheme.textDim, fontSize: "9.5px", textAlign: "center", lineHeight: 1.6, padding: "0 4px" }}>{comp.label}立绘<br/>待投放</span>
            )}
            <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, fontSize: "9px", textAlign: "center", color: "var(--paper)", background: "rgba(0,0,0,0.55)", padding: "1px 0" }}>{comp.label}</span>
          </div>
          {compLore && (
            <>
              <div style={{ display: "flex", gap: 4 }}>
                {COMPANION_DESC_FORMS.map(f => (
                  <span key={f.key} onClick={() => pickCompForm(f.key)}
                    title={`注入 AI 的${comp.label}外貌描述：${f.label}`}
                    style={{
                      cursor: "pointer", fontSize: "9.5px", padding: "1px 7px", borderRadius: 0,
                      color: compForm === f.key ? zoneTheme.bg : zoneTheme.accent,
                      background: compForm === f.key ? zoneTheme.accent : zoneTheme.bgPanel,
                      border: `1px solid ${compForm === f.key ? zoneTheme.accent : zoneTheme.border}`,
                    }}>{f.label}</span>
                ))}
              </div>
              <span onClick={() => setCompDescOpen(v => !v)}
                title="展开/收起这段会发给 AI 的外貌描述"
                style={{ cursor: "pointer", fontSize: "9px", color: zoneTheme.textDim, whiteSpace: "nowrap" }}>
                外貌描述 {compDescOpen ? "▴" : "▾"}
              </span>
              {compDescOpen && (
                <div style={{ fontSize: "9.5px", color: zoneTheme.textDim, lineHeight: 1.6, background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`, borderRadius: 0, padding: "4px 6px", maxHeight: 160, overflowY: "auto", textAlign: "left" }}>
                  {compLore.base}{compForm === "human" ? compLore.human : compLore.beast}
                </div>
              )}
            </>
          )}
        </div>
      )}
      <div style={{ flex: 1, paddingTop: 4 }}>
        <div style={{ fontSize: "16px", color: zoneTheme.accent, fontWeight: "bold", letterSpacing: "1px", marginBottom: 3 }}>{char.name || "无名少侠"}</div>
        <div style={{ fontSize: "11px", color: zoneTheme.textDim, marginBottom: 8 }}>{char.gender || "男"}　少侠</div>
        <div style={{ fontSize: "11.5px", marginBottom: 3 }}>气血 <span style={{ color: char.hp[0] <= 30 ? "var(--red-soft)" : "var(--ink-text)" }}>{bar(char.hp[0], char.hp[1], 8)}</span></div>
        <div style={{ fontSize: "11.5px", marginBottom: 5 }}><span style={{ color: char.hp[0] <= 30 ? "var(--red-soft)" : "var(--attr-value)" }}>{char.hp[0]}/{char.hp[1]}</span></div>
        <div style={{ fontSize: "11.5px", marginBottom: 3 }}>经验 <span style={{ color: "var(--ink-warn)" }}>{exp}</span>　潜能 <span style={{ color: "var(--violet)" }}>{pot}</span></div>
        <div style={{ fontSize: "11.5px" }}>银两 <span style={{ color: "var(--gold-bright)" }}>{char.money || 0}</span> 两</div>
        <div style={{ fontSize: "11.5px", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
          <span>信鸽 <span style={{ color: "var(--gold)" }}>{char.pigeons || 0}</span> 只</span>
          <span
            onClick={() => inspectItem("pigeon", "信鸽", `现有${char.pigeons || 0}只`, null, { worldLook: true })}
            title="查看：信鸽是什么、能做什么"
            style={{
              cursor: inspecting === "信鸽" ? "wait" : "pointer", fontSize: "10px", padding: "1px 5px", borderRadius: 0,
              color: zoneTheme.textDim, background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`,
              opacity: inspecting === "信鸽" ? 0.6 : 1,
            }}
          >查看{inspecting === "信鸽" ? "…" : ""}</span>
        </div>
      </div>
    </div>
  );
}
