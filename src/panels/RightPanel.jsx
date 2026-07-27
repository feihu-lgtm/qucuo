import { QUALITY_COLOR, ITEM_CATEGORY, CATEGORY_LABEL, computeEquippedStats, toggleEquip } from "../equipment.js";
import { bar, STAGES, STAGE_UP_COST } from "../utils/mudHelpers.js";
import { npcAffectionLabel } from "../mvu.js";
import { SNOW_LEOPARD_FORMS, snowLeopardPortraitUrl } from "../portraits.js";
import { isSnowLeopardAvailable } from "../companion.js";
import { bodyProfileFilled } from "../bodyProfile.js";
import { NNPC_STAGE, affectionLabel } from "../narrator.js";
import { CATALOG_INDEX } from "../items/catalog.js";

export default function RightPanel({
  isMobile, mobileDrawer, setMobileDrawer,
  zoneTheme, S,
  char, inv, skills, exp, pot,
  playerAvatar, setShowAvatarPicker,
  companionState, slForm, setSnowLeopardForm, setSlFormState, slImgErr, setSlImgErr,
  setShowBody,
  trainNeigong, trainWaigong, trainCost,
  effectiveSpecialNow, activeBuffs,
  varTree,
  setActiveNpcMenu,
  setSkills, inspectItem, inspecting,
  breakthroughSkill,
  setActiveItemMenu,
  narrator, confessToNarrator,
  setInv,
}) {
  return (
    <div style={isMobile
      ? { position: "fixed", top: 0, bottom: 0, right: 0, width: "82vw", maxWidth: 340, zIndex: 41,
          transform: mobileDrawer === "right" ? "translateX(0)" : "translateX(100%)",
          transition: "transform .28s ease", boxShadow: mobileDrawer === "right" ? "-4px 0 24px rgba(0,0,0,.6)" : "none",
          background: zoneTheme.bg, display: "flex", flexDirection: "column", overflow: "hidden" }
      : { flex: 30, ...S.panel, borderRight: "none" }}>
      {isMobile && (
        <div onClick={() => setMobileDrawer(null)} style={{ padding: "8px 12px", color: zoneTheme.textDim, cursor: "pointer", fontSize: "13px", flexShrink: 0 }}>✕ 关闭</div>
      )}
      <div style={S.label}>侠客</div>
      <div style={S.scroll}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
          <div
            onClick={() => setShowAvatarPicker(true)}
            title="点击更换头像"
            style={{
              width: 90, aspectRatio: "2/3", flexShrink: 0, borderRadius: 6, overflow: "hidden",
              border: `1px solid ${zoneTheme.border}`, background: "#0c0e14", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
            }}
          >
            {playerAvatar ? (
              <img src={playerAvatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: zoneTheme.textDim, fontSize: "10px", textAlign: "center", lineHeight: 1.6 }}>点击<br/>设置头像</span>
            )}
            <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, fontSize: "9px", textAlign: "center", color: "#e8dcc0", background: "rgba(0,0,0,0.55)", padding: "1px 0" }}>换像</span>
          </div>
          {companionState?.snowLeopard?.unlocked && (
            <div
              onClick={() => {
                const forms = SNOW_LEOPARD_FORMS;
                const idx = forms.findIndex(f => f.key === slForm);
                const next = forms[(idx + 1) % forms.length];
                setSnowLeopardForm(next.key); setSlFormState(next.key); setSlImgErr(false);
              }}
              title="雪豹 · 点击切换形态"
              style={{
                width: 90, aspectRatio: "2/3", flexShrink: 0, borderRadius: 6, overflow: "hidden",
                border: `1px solid ${zoneTheme.border}`, background: "#0c0e14", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              }}
            >
              {!slImgErr ? (
                <img src={snowLeopardPortraitUrl(slForm)} alt="雪豹" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={() => setSlImgErr(true)} />
              ) : (
                <span style={{ color: zoneTheme.textDim, fontSize: "9.5px", textAlign: "center", lineHeight: 1.6, padding: "0 4px" }}>雪豹立绘<br/>待投放</span>
              )}
              <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, fontSize: "9px", textAlign: "center", color: "#e8dcc0", background: "rgba(0,0,0,0.55)", padding: "1px 0" }}>雪豹</span>
            </div>
          )}
          <div style={{ flex: 1, paddingTop: 4 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <div style={{ fontSize: "16px", color: zoneTheme.accent, fontWeight: "bold", letterSpacing: "1px", marginBottom: 3 }}>{char.name || "无名少侠"}</div>
              <span
                onClick={() => setShowBody(true)}
                title="体貌 · 身量体型与身体细节，动作描写和私聊都会照着写"
                style={{
                  marginLeft: "auto", cursor: "pointer", fontSize: "10px", padding: "1px 6px",
                  borderRadius: 3, border: `1px solid ${zoneTheme.border}`,
                  color: bodyProfileFilled(char.bodyProfile).total ? zoneTheme.accent : zoneTheme.textDim,
                }}
              >
                ◈ 体貌{bodyProfileFilled(char.bodyProfile).total ? ` ${bodyProfileFilled(char.bodyProfile).total}` : ""}
              </span>
            </div>
            <div style={{ fontSize: "11px", color: zoneTheme.textDim, marginBottom: 8 }}>{char.gender || "男"}　少侠</div>
            <div style={{ fontSize: "11.5px", marginBottom: 3 }}>气血 <span style={{ color: char.hp[0] <= 30 ? "#c45044" : "#c8bfa0" }}>{bar(char.hp[0], char.hp[1], 8)}</span></div>
            <div style={{ fontSize: "11.5px", marginBottom: 5 }}><span style={{ color: char.hp[0] <= 30 ? "#c45044" : "#888" }}>{char.hp[0]}/{char.hp[1]}</span></div>
            <div style={{ fontSize: "11.5px", marginBottom: 3 }}>经验 <span style={{ color: "#d4a853" }}>{exp}</span>　潜能 <span style={{ color: "#b48adf" }}>{pot}</span></div>
            <div style={{ fontSize: "11.5px" }}>银两 <span style={{ color: "#e8c468" }}>{char.money || 0}</span> 两</div>
            <div style={{ fontSize: "11.5px", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
              <span>信鸽 <span style={{ color: "#c4a040" }}>{char.pigeons || 0}</span> 只</span>
              <span
                onClick={() => inspectItem("pigeon", "信鸽", `现有${char.pigeons || 0}只`, null, { worldLook: true })}
                title="查看：信鸽是什么、能做什么"
                style={{
                  cursor: inspecting === "信鸽" ? "wait" : "pointer", fontSize: "10px", padding: "1px 5px", borderRadius: 3,
                  color: zoneTheme.textDim, background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`,
                  opacity: inspecting === "信鸽" ? 0.6 : 1,
                }}
              >查看{inspecting === "信鸽" ? "…" : ""}</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          {(() => {
            const es = computeEquippedStats(inv);
            return <div style={{ fontSize: "11px", color: "#8a8a7a" }}>装备总加成：攻{es.totalAtk} 防{es.totalDef} 饰品+{es.accessoryBonus.toFixed(1)}</div>;
          })()}
        </div>

        <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10, display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>内功外功</div>
            <div style={{ fontSize: "11.5px", display: "flex", alignItems: "center", gap: 6 }}>
              <span>内功 <span style={{ color: "#b48adf" }}>{bar(char.neigong ?? 0, 100, 6)}</span> <span style={{ color: "#888" }}>{char.neigong ?? 0}</span></span>
              <span
                onClick={trainNeigong}
                title={`运气打坐：消耗${trainCost(char.neigong ?? 0)}点潜能，内功+1（现有潜能${pot}）`}
                style={{
                  cursor: "pointer", fontSize: "10px", padding: "1px 5px", borderRadius: 3,
                  color: "#8ab4d4", background: zoneTheme.bgPanel, border: "1px solid #1d2d3a", whiteSpace: "nowrap",
                }}
              >+1（{trainCost(char.neigong ?? 0)}潜能）</span>
            </div>
            <div style={{ fontSize: "11.5px", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span>外功 <span style={{ color: "#d85a30" }}>{bar(char.waigong ?? 0, 100, 6)}</span> <span style={{ color: "#888" }}>{char.waigong ?? 0}</span></span>
              <span
                onClick={trainWaigong}
                title={`拆招练武：消耗${trainCost(char.waigong ?? 0)}点潜能，外功+1（现有潜能${pot}）`}
                style={{
                  cursor: "pointer", fontSize: "10px", padding: "1px 5px", borderRadius: 3,
                  color: "#d88a5a", background: zoneTheme.bgPanel, border: "1px solid #3a2a1d", whiteSpace: "nowrap",
                }}
              >+1（{trainCost(char.waigong ?? 0)}潜能）</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>七维</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px", fontSize: "11px" }}>
              {Object.entries(char.special || {}).map(([k, v]) => {
                const eff = effectiveSpecialNow?.[k];
                const buffed = typeof eff === "number" && eff !== v;
                return (
                  <div key={k} title={buffed ? `基础${v}，药力/buff生效中` : undefined}>
                    {k}
                    <span style={{ color: buffed ? "#8ac48a" : "#c8bfa0" }}>{buffed ? eff : v}</span>
                    {buffed && <span style={{ color: "#5a5a4a", fontSize: "9.5px" }}> ({v}+{eff - v})</span>}
                  </div>
                );
              })}
            </div>
            {activeBuffs.length > 0 && (
              <div style={{ marginTop: 4, fontSize: "9.5px", color: "#8ac48a", lineHeight: 1.5 }}>
                {activeBuffs.map((b, i) => (
                  <div key={i}>药力·{b.attr}+{b.val}（余{b.remaining}）</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isSnowLeopardAvailable(companionState) && (() => {
          const slData = companionState.snowLeopard.data;
          const slAffection = varTree.角色?.雪豹?.好感度;
          return (
            <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
              <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>队伍</div>
              <div
                onClick={() => setActiveNpcMenu({ ...slData, brief: "格桑的雪豹，通体雪白的灵兽，随行在侧" })}
                title="打开互动菜单：细看/切磋/送礼等"
                style={{
                  display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                  padding: "6px 8px", borderRadius: 4, background: zoneTheme.bgPanel,
                  border: `1px solid ${zoneTheme.border}`,
                }}
              >
                <span style={{ fontSize: "16px" }}>🐆</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "11.5px", color: zoneTheme.text }}>雪豹</div>
                  {typeof slAffection === "number" ? (
                    <div style={{ fontSize: "10px", color: "#e0a0d0" }}>{npcAffectionLabel(slAffection)} · {slAffection}/100</div>
                  ) : (
                    <div style={{ fontSize: "10px", color: zoneTheme.textDim }}>随行伙伴</div>
                  )}
                </div>
                <span style={{ fontSize: "9.5px", color: zoneTheme.textDim }}>◈</span>
              </div>
            </div>
          );
        })()}

        <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
          <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>武学 <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>点名字看介绍 · 点圈运功上阵（每类只运一门，▶已上阵）</span></div>
          {skills.map((s, i) => {
            const q = s.quality || "白";
            const qc = QUALITY_COLOR[q] || "#c8bfa0";
            return (
              <div key={i} style={{ marginBottom: 4, padding: "3px 0", borderLeft: s.active ? `2px solid ${qc}` : "2px solid transparent", paddingLeft: 6, opacity: s.active ? 1 : 0.62 }}>
                <div style={{ fontSize: "11.5px", display: "flex", alignItems: "center", gap: 4 }}>
                  <span
                    onClick={() => setSkills(sk => {
                      const tgt = sk[i];
                      const tType = tgt.moveType;
                      const turningOn = !tgt.active;
                      return sk.map((ss, j) => {
                        if (j === i) return { ...ss, active: turningOn };
                        if (turningOn && tType && ss.moveType === tType) return { ...ss, active: false };
                        return ss;
                      });
                    })}
                    style={{ cursor: "pointer", color: s.active ? qc : "#6a6a5a" }}
                    title={s.active ? "已上阵，点击卸下" : "运功上阵"}
                  >{s.active ? "▶" : "○"}</span>
                  <span
                    onClick={() => inspectItem("skill", s.name, s.fixed ? `${q}品·授业绝学（完整）` : `${q}品·${s.stage}`, null, { worldLook: true })}
                    style={{ cursor: inspecting === s.name ? "wait" : "pointer", color: qc, fontWeight: s.active ? "bold" : "normal", textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: zoneTheme.textDim, opacity: inspecting === s.name ? 0.6 : 1 }}
                  >{s.name}{s.fixed ? "" : `·${s.stage}`}{inspecting === s.name ? "…" : ""}</span>
                  <span style={{ fontSize: "9.5px", color: qc, opacity: 0.9 }}>（{q}品）</span>
                  {s.fixed && (() => {
                    const src = s.source || "拜师";
                    const label = src === "偷师" ? "偷" : src === "拜师·通用" ? "通" : "授";
                    const title = src === "偷师" ? "偷师所得" : src === "拜师·通用" ? "拜师·通用招" : "拜师·授业绝学";
                    return <span title={title} style={{ fontSize: "9px", color: zoneTheme.textDim, border: `1px solid ${zoneTheme.border}`, borderRadius: 2, padding: "0 3px" }}>{label}</span>;
                  })()}
                </div>
                {s.fixed
                  ? <div style={{ paddingLeft: 18 }}>
                      <div style={{ fontSize: "10.5px", color: "#5a5a4a" }}>
                        {s.source === "偷师" ? "偷师所得 · 学即完整，无需修炼" : s.source === "拜师·通用" ? "拜师·通用招 · 学即完整，无需修炼" : "授业绝学 · 学即完整，无需修炼"}
                      </div>
                      {s.move?.desc && <div style={{ fontSize: "10px", color: zoneTheme.textDim, marginTop: 2, lineHeight: 1.65 }}>{s.move.desc}</div>}
                    </div>
                  : (() => {
                      const curIdx = STAGES.indexOf(s.stage);
                      const maxed = curIdx >= STAGES.length - 1;
                      const nextStage = maxed ? null : STAGES[curIdx + 1];
                      const cost = nextStage ? (STAGE_UP_COST[nextStage] ?? 12) : 0;
                      const afford = pot >= cost;
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 18, marginTop: 1 }}>
                          <span style={{ fontSize: "10px", color: "#7a7a6a" }}>
                            阶段 {curIdx + 1}/5 · {s.stage}
                          </span>
                          {maxed
                            ? <span style={{ fontSize: "10px", color: qc }}>✦ 登峰造极</span>
                            : <span
                                onClick={() => afford && breakthroughSkill(s.id)}
                                title={afford ? `潜心修炼：花${cost}潜能，${s.stage}→${nextStage}（现有潜能${pot}）` : `潜能不足，突破${nextStage}需${cost}点（现有${pot}）`}
                                style={{
                                  cursor: afford ? "pointer" : "not-allowed", fontSize: "10px", padding: "1px 7px", borderRadius: 3,
                                  color: afford ? "#b48adf" : "#5a5a4a",
                                  background: afford ? zoneTheme.bgPanel : "transparent",
                                  border: `1px solid ${afford ? "#4a3a5a" : zoneTheme.border}`, userSelect: "none",
                                }}
                              >↑修炼·{nextStage}（{cost}潜能）</span>}
                        </div>
                      );
                    })()}
              </div>
            );
          })}
        </div>

        {(() => {
          const extras = (char.moveset || []).filter(m => !m.sourceSkill);
          if (!extras.length) return null;
          const TYPE_SHORT = { 攻击: "攻", 防御: "防", 状态: "状" };
          return (
            <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
              <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>临阵招式 <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>切磋自带补位 · 运功对应类型的武学即替换（回气永在，能量枯竭保命）</span></div>
              {extras.map((m, i) => {
                const q = m.quality || "白";
                const qc = QUALITY_COLOR[q] || "#c8bfa0";
                const origin = m.learnedFromMaster ? "授" : "基础";
                return (
                  <div key={i} style={{ marginBottom: 3, fontSize: "11px", display: "flex", alignItems: "center", gap: 5, opacity: 0.92, paddingLeft: 6 }}>
                    <span style={{ fontSize: "9px", color: "#1a1206", background: qc, borderRadius: 2, padding: "0 3px", fontWeight: 700 }}>{TYPE_SHORT[m.type] || "?"}</span>
                    <span
                      onClick={() => inspectItem("skill", m.name, `${q}品·临阵招式（${origin}）`, null, { worldLook: true })}
                      style={{ cursor: inspecting === m.name ? "wait" : "pointer", color: qc, textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: zoneTheme.textDim, opacity: inspecting === m.name ? 0.6 : 1 }}
                    >{m.name}{inspecting === m.name ? "…" : ""}</span>
                    <span style={{ fontSize: "9.5px", color: qc, opacity: 0.9 }}>（{q}品）</span>
                    <span style={{ fontSize: "9px", color: zoneTheme.textDim }}>{origin}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
          <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>装备 <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>点物品切换装备/卸下</span></div>
          {[ITEM_CATEGORY.WEAPON, ITEM_CATEGORY.ARMOR, ITEM_CATEGORY.ACCESSORY].map(cat => {
            const itemsInCat = inv.filter(i => typeof i === "object" && i.category === cat);
            const equippedCount = itemsInCat.filter(i => i.equipped).length;
            return (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: "10.5px", color: "#7a7a6a", marginBottom: 3 }}>
                  {CATEGORY_LABEL[cat]} <span style={{ color: zoneTheme.textDim }}>（{itemsInCat.length}件，{equippedCount}件已装备）</span>
                </div>
                {itemsInCat.length === 0 && <div style={{ fontSize: "10.5px", color: zoneTheme.textDim, paddingLeft: 8 }}>无</div>}
                {itemsInCat.map(item => {
                  const statLabel = item.atk != null ? `攻${item.atk}` : item.def != null ? `防${item.def}` : item.bonus != null ? `+${item.bonus}` : "";
                  return (
                    <div
                      key={item.id}
                      onClick={() => setInv(v => toggleEquip(v, item.id))}
                      style={{
                        fontSize: "11px", cursor: "pointer", paddingLeft: 8, marginBottom: 2,
                        color: item.equipped ? QUALITY_COLOR[item.quality] : "#5a5a4a",
                        fontWeight: item.equipped ? "bold" : "normal",
                        wordBreak: "break-word",
                      }}
                    >
                      {item.equipped ? "▶" : "○"} {item.name} <span style={{ fontSize: "9.5px" }}>({item.quality}{statLabel ? `·${statLabel}` : ""})</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8, marginBottom: 10 }}>
          <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>包袱 <span style={{ color: zoneTheme.textDim }}>{inv.length}件 · 点击看介绍</span></div>
          {inv.map((it, i) => {
            const isObj = typeof it === "object";
            const name = isObj ? it.name : it;
            const quality = isObj ? (it.quality || "白") : null;
            const color = isObj ? (QUALITY_COLOR[quality] || "#c4a040") : "#c4a040";
            const canConsume = !!((isObj && it.consumable) || CATALOG_INDEX[name]?.consumable);
            return (
              <div
                key={isObj ? (it.id || i) : i}
                onClick={() => setActiveItemMenu({ item: it, mode: "inventory", canConsume })}
                style={{ fontSize: "11.5px", color, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: color, display: "flex", alignItems: "center", gap: 4 }}
              >
                <span style={{ flex: 1 }}>· {name}{isObj ? ` (${quality})` : ""}{isObj && it.equipped ? " [已装备]" : ""}</span>
                {canConsume && <span style={{ fontSize: "10px", color: zoneTheme.accentDim, flexShrink: 0 }}>⊙用</span>}
                {isObj && !canConsume && ["weapon", "armor", "accessory"].includes(it.category) &&
                  <span style={{ fontSize: "10px", color: zoneTheme.accentDim, flexShrink: 0 }}>{it.equipped ? "⊙卸" : "⊙穿"}</span>}
              </div>
            );
          })}
          {inv.length === 0 && <div style={{ color: zoneTheme.textDim, fontSize: "11.5px" }}>空空如也</div>}
        </div>

        <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 8 }}>
          <div style={{ fontSize: "11px", color: zoneTheme.accentDim, marginBottom: 4 }}>旁白</div>
          {narrator.stage === NNPC_STAGE.CRASHED ? (
            <div style={{ fontSize: "11.5px", color: "#c45044" }}>信号已断开</div>
          ) : narrator.confessed ? (
            <div style={{ fontSize: "11.5px", color: "#f0c060" }}>已告白 · 记忆碎片 {narrator.memoryFragments}/8</div>
          ) : (
            <>
              <div style={{ fontSize: "11.5px", color: "#e0a0d0" }}>{affectionLabel(narrator.affection)}</div>
              <div style={{ fontSize: "11.5px" }}>{bar(narrator.affection, 100, 8)} {narrator.affection}/100</div>
              {narrator.affection >= 100 && (
                <div
                  onClick={confessToNarrator}
                  title="向旁白告白"
                  style={{ marginTop: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 20, height: 20, borderRadius: "50%",
                    background: "#f0a0c0", color: "#3a1020", fontWeight: 700, fontSize: "14px",
                    boxShadow: "0 0 6px #f0a0c0", animation: "pulse 1.6s ease-in-out infinite",
                  }}>!</span>
                  <span style={{ color: "#f0a0c0", fontSize: "11px" }}>心意已满，可向旁白告白</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
