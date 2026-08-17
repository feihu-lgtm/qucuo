import React, { useState, useMemo, useEffect } from "react";
import { useOverlayCloseGuard } from "../utils/overlayClose.js";
import {
  TECHNIQUES, TECHNIQUE_IDS, COOKWARE, COOKWARE_BY_ID, DEFAULT_COOKWARE_ID,
  matchRecipe, canUseTechnique, computeDish, genericDishEffect,
  ownedCookware, availableMaterials, INGREDIENT_LORE,
} from "../cooking.js";

// 烹饪台：六格槽位（料×4 + 技法×1 + 炊具×1）。UI 素材沿用赌石那套精美木质/纸面
// 贴图（public/stones/ui/），backgroundSize "100% 100%" 拉伸铺满（与 GambleStoneScreen
// 同一约定，这批图本是整幅设计好的，拉伸幅度不大时观感没问题）。
const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
const UI = (f) => `${BASE}stones/ui/${f}`;

const QUAL_COLOR = { 白: "#e8e4d6", 绿: "#6aaa6a", 蓝: "#5a9adf", 紫: "#b48adf", 橙: "#e0913a", 红: "#d4756a" };

// 灶膛火苗 + 蒸汽 + 成功/失败反馈的 CSS（组件内注入，命名空间 ck- 防串味）
const CK_CSS = `
  .ck-flame{ display:inline-block; transform-origin:50% 100%;
    animation:ckFlick 1.1s ease-in-out infinite; filter:drop-shadow(0 0 6px rgba(240,150,60,.8)); }
  .ck-flame:nth-child(2){ animation-delay:.25s; font-size:.8em; }
  .ck-flame:nth-child(3){ animation-delay:.55s; }
  .ck-flame:nth-child(4){ animation-delay:.4s; font-size:.7em; }
  @keyframes ckFlick{
    0%,100%{ transform:scaleY(1) translateY(0); opacity:.95; }
    30%{ transform:scaleY(1.25) translateY(-2px) scaleX(.92); opacity:1; }
    60%{ transform:scaleY(.85) translateY(1px) scaleX(1.06); opacity:.8; }
  }
  .ck-ember{ position:absolute; left:50%; bottom:-6px; transform:translateX(-50%);
    width:70%; height:26px; border-radius:50%;
    background:radial-gradient(ellipse at center, rgba(240,140,50,.55) 0%, rgba(200,80,30,.25) 45%, transparent 75%);
    animation:ckGlow 1.6s ease-in-out infinite; pointer-events:none; }
  @keyframes ckGlow{ 0%,100%{ opacity:.6; } 50%{ opacity:1; } }
  .ck-steam{ position:absolute; bottom:100%; left:50%; width:3px; height:26px; border-radius:3px;
    background:linear-gradient(180deg, transparent, rgba(230,225,210,.5));
    animation:ckSteam 2.4s ease-out infinite; opacity:0; pointer-events:none; }
  @keyframes ckSteam{
    0%{ transform:translate(-50%,8px) scaleY(.4); opacity:0; }
    30%{ opacity:.7; }
    100%{ transform:translate(-50%,-30px) scaleY(1.3) translateX(6px); opacity:0; }
  }
  .ck-shake{ animation:ckShake .4s ease-in-out; }
  @keyframes ckShake{
    0%,100%{ transform:translateX(0); }
    20%{ transform:translateX(-6px) rotate(-.6deg); }
    45%{ transform:translateX(5px) rotate(.5deg); }
    70%{ transform:translateX(-3px); }
  }
  .ck-pop{ animation:ckPop .55s cubic-bezier(.34,1.56,.64,1) both; }
  @keyframes ckPop{ 0%{ transform:scale(.3); opacity:0; } 70%{ transform:scale(1.12); } 100%{ transform:scale(1); opacity:1; } }
  .ck-fadein{ animation:ckFade .35s ease-out both; }
  @keyframes ckFade{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:none; } }
  .ck-chip{ transition:transform .12s, filter .12s; }
  .ck-chip:hover{ transform:translateY(-2px); filter:brightness(1.15); }
`;

export default function CookingScreen({ building, char, inv, zoneTheme, inline, onClose, onCook }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const [slots, setSlots] = useState([null, null, null, null]); // 料①~④，调味料/食材混装
  const [techniqueId, setTechniqueId] = useState("炖");
  const [cookwareId, setCookwareId] = useState(DEFAULT_COOKWARE_ID);
  const [fx, setFx] = useState(null);        // {kind:"ok"|"fail", dish?} 开火反馈
  const [warn, setWarn] = useState("");

  const maxHp = char?.hp?.[1] ?? 100;
  const cookwares = useMemo(() => ownedCookware(inv), [inv]);
  const cookware = COOKWARE_BY_ID[cookwareId] || COOKWARE_BY_ID[DEFAULT_COOKWARE_ID];
  const mats = useMemo(() => availableMaterials(inv), [inv]);

  // 槽内同名计数 → 剩余可放数量
  const slotCounts = {};
  slots.forEach(s => { if (s) slotCounts[s] = (slotCounts[s] || 0) + 1; });
  const remaining = (name) => (mats.find(m => m.name === name)?.count || 0) - (slotCounts[name] || 0);

  const filled = slots.filter(Boolean);
  const recipe = filled.length ? matchRecipe(filled, techniqueId) : null;
  const techOk = canUseTechnique(techniqueId, cookware);
  // 命中固定配方 →  deterministic；料+技法齐但没配上 → 妙手偶得（freestyle），
  // 数值走系统保底，菜名与风味交给主叙事 AI 想象（小总结）。
  const freestyle = !recipe && filled.length > 0 && techOk;
  const dish = recipe && techOk
    ? computeDish(recipe, techniqueId, cookware, maxHp)
    : (freestyle ? { ...genericDishEffect(techniqueId, cookware, maxHp), name: null, desc: null } : null);

  // 炊具被收走/不在背包时回退默认锅（ownedCookware 变化时纠偏）
  useEffect(() => {
    if (!cookwares.some(c => c.id === cookwareId)) setCookwareId(DEFAULT_COOKWARE_ID);
  }, [cookwares, cookwareId]);

  function putMaterial(name) {
    if (fx?.kind === "ok") return;
    if (remaining(name) <= 0) return;
    setSlots(prev => {
      const i = prev.indexOf(null);
      if (i < 0) return prev;
      const next = [...prev]; next[i] = name; return next;
    });
    setWarn("");
  }
  function clearSlot(i) {
    setSlots(prev => { const next = [...prev]; next[i] = null; return next; });
  }
  function clearAll() { setSlots([null, null, null, null]); setWarn(""); setFx(null); }

  function fire() {
    if (fx?.kind === "ok") return;
    if (!filled.length) { setWarn("灶膛烧得正旺，可锅里空空如也——先放点料。"); setFx({ kind: "fail" }); return; }
    if (!techOk) { setWarn(`${TECHNIQUES[techniqueId].icon} 「${techniqueId}」需要能蒸的炊具（蒸笼/石灶釜/青铜鼎）。换一件家什。`); setFx({ kind: "fail" }); return; }
    if (!dish) { setWarn("这几样凑在一起，灶神直摇头——翻翻菜谱，换种搭配或技法再试。"); setFx({ kind: "fail" }); return; }
    const t = TECHNIQUES[techniqueId];
    onCook?.({
      materials: [...filled],
      lore: filled.map(n => INGREDIENT_LORE[n]).filter(Boolean),
      technique: { id: techniqueId, desc: t.desc },
      cookware: { name: cookware.name, desc: cookware.desc },
      freestyle,
      dish,
    });
    setFx({ kind: "ok", dish: { ...dish, name: dish.name || "妙手偶得" }, freestyle });
    setTimeout(() => { setFx(null); setSlots([null, null, null, null]); }, 1500);
  }

  const panel = (
    <div style={{ position: "relative", background: "linear-gradient(180deg,#1d1309 0%, #140c06 55%, #0d0805 100%)",
      minHeight: "100%", color: "#e8d5b0", fontFamily: "inherit" }}
      onMouseDown={inline ? undefined : closeGuard.onMouseDown}
      onClick={inline ? undefined : closeGuard.onClick}>
      <style>{CK_CSS}</style>

      {/* ── 灶台门面：木匾抬头 ── */}
      <div style={{ position: "relative", margin: "14px 16px 0", padding: "10px 18px",
        backgroundImage: `url(${UI("bar_wood.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
        display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#f5e2b8", fontSize: 15, fontWeight: "bold", letterSpacing: 3, textShadow: "0 1px 2px #000" }}>
          🔥 烹饪台 <span style={{ color: "#c8a860", fontSize: 11.5, fontWeight: "normal", letterSpacing: 1, marginLeft: 6 }}>{building?.name || "灶房"}</span>
        </span>
        <span onClick={onClose} title="关闭" style={{ cursor: "pointer", width: 26, height: 26, flexShrink: 0,
          backgroundImage: `url(${UI("btn_close.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }} />
      </div>

      <div style={{ padding: "14px 18px 26px" }}>
        {/* ── ① 四格料槽 ── */}
        <div style={{ color: "#a08a5a", fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>料 · 调味料与食材混装（点击放入，点格取回）</div>
        <div className={fx?.kind === "fail" ? "ck-shake" : undefined}
          style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, position: "relative", paddingBottom: 26 }}>
          {slots.map((s, i) => (
            <div key={i} onClick={() => s && clearSlot(i)}
              className="ck-chip"
              style={{ position: "relative", aspectRatio: "1/0.82", cursor: s ? "pointer" : "default",
                backgroundImage: `url(${UI("box_wood.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "8% 6%", boxSizing: "border-box", textAlign: "center" }}>
              <span style={{ position: "absolute", top: "6%", left: "10%", fontSize: 9.5, color: "#8a7040", letterSpacing: 1 }}>料{i + 1}</span>
              {s
                ? <span style={{ color: "#f5e2b8", fontSize: 12.5, fontWeight: "bold", lineHeight: 1.35, textShadow: "0 1px 2px #000" }}>{s}</span>
                : <span style={{ color: "#5a4a30", fontSize: 11 }}>空</span>}
            </div>
          ))}
          {/* 灶膛火苗：料槽之下，开火成功时蹿高 */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center", pointerEvents: "none" }}>
            <span className="ck-flame" style={{ fontSize: fx?.kind === "ok" ? 22 : 15 }}>🔥</span>
            <span className="ck-flame" style={{ fontSize: fx?.kind === "ok" ? 18 : 11 }}>🔥</span>
            <span className="ck-flame" style={{ fontSize: fx?.kind === "ok" ? 24 : 17 }}>🔥</span>
            <span className="ck-flame" style={{ fontSize: fx?.kind === "ok" ? 16 : 10 }}>🔥</span>
          </div>
          <div className="ck-ember" style={{ opacity: filled.length ? undefined : 0.25 }} />
        </div>

        {/* ── ② 技法槽 ── */}
        <div style={{ color: "#a08a5a", fontSize: 11, letterSpacing: 2, margin: "14px 0 8px" }}>技法 · 五选一</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TECHNIQUE_IDS.map(tid => {
            const t = TECHNIQUES[tid];
            const sel = techniqueId === tid;
            const usable = canUseTechnique(tid, cookware);
            return (
              <div key={tid} onClick={() => { setTechniqueId(tid); setWarn(""); }}
                className="ck-chip"
                title={t.desc}
                style={{ position: "relative", cursor: "pointer", padding: "7px 16px", minWidth: 58, textAlign: "center",
                  backgroundImage: `url(${UI(sel ? "bar_paper.webp" : "bar_wood.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
                  color: sel ? "#4a2d0a" : "#d8c8a0", fontSize: 13, fontWeight: "bold", letterSpacing: 2,
                  opacity: usable ? 1 : 0.45, textShadow: sel ? "0 1px 0 rgba(255,255,255,.3)" : "0 1px 2px #000" }}>
                {t.icon} {tid}
                {!usable && <span style={{ position: "absolute", top: -5, right: -3, fontSize: 9, color: "#e0913a" }}>需蒸笼</span>}
              </div>
            );
          })}
        </div>

        {/* ── ③ 炊具槽 ── */}
        <div style={{ color: "#a08a5a", fontSize: 11, letterSpacing: 2, margin: "14px 0 8px" }}>炊具 · 囊中所有（{cookwares.length}/{COOKWARE.length}）</div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {cookwares.map(cw => {
            const sel = cookwareId === cw.id;
            return (
              <div key={cw.id} onClick={() => { setCookwareId(cw.id); setWarn(""); }}
                className="ck-chip" title={cw.desc}
                style={{ flexShrink: 0, cursor: "pointer", padding: "7px 14px", textAlign: "center",
                  backgroundImage: `url(${UI(sel ? "bar_paper.webp" : "bar_wood.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
                  color: sel ? "#4a2d0a" : "#d8c8a0", fontSize: 12, fontWeight: "bold",
                  textShadow: sel ? "0 1px 0 rgba(255,255,255,.3)" : "0 1px 2px #000" }}>
                <span style={{ color: sel ? "#8a5a1a" : (QUAL_COLOR[cw.quality] || "#e8e4d6"), marginRight: 5, fontSize: 11 }}>●</span>
                {cw.name}{cw.canSteam ? " ♨" : ""}
              </div>
            );
          })}
        </div>
        <div style={{ color: "#6a5a3a", fontSize: 10.5, marginTop: 4, lineHeight: 1.6, fontStyle: "italic" }}>{cookware.desc}</div>

        {/* ── ④ 预测卷轴 ── */}
        <div style={{ position: "relative", margin: "18px 0 4px", aspectRatio: "482/130",
          backgroundImage: `url(${UI("scroll_h.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12%", boxSizing: "border-box", textAlign: "center" }}>
          {fx?.kind === "ok" ? (
            <div className="ck-pop" style={{ position: "relative" }}>
              <img src={UI("burst.webp")} alt="" style={{ position: "absolute", left: "50%", top: "50%", width: "160%", height: "260%",
                transform: "translate(-50%,-50%)", objectFit: "contain", opacity: 0.85, pointerEvents: "none" }} />
              {fx.freestyle ? (
                <>
                  <div style={{ position: "relative", color: "#8a4a10", fontSize: 16, fontWeight: "bold", letterSpacing: 3 }}>妙手偶得！</div>
                  <div style={{ position: "relative", color: "#6a4a20", fontSize: 11, marginTop: 2 }}>灶神即兴赐名，最小化看这段小总结</div>
                </>
              ) : (
                <>
                  <div style={{ position: "relative", color: "#8a4a10", fontSize: 16, fontWeight: "bold", letterSpacing: 3 }}>「{fx.dish.name}」出锅！</div>
                  <div style={{ position: "relative", color: "#6a4a20", fontSize: 11, marginTop: 2 }}>香气四溢，趁热收进囊中</div>
                </>
              )}
            </div>
          ) : dish ? (
            <div className="ck-fadein" key={(dish.name || "free") + techniqueId + cookwareId}>
              {dish.name ? (
                <div style={{ color: "#5a3d1a", fontSize: 14.5, fontWeight: "bold", letterSpacing: 2 }}>可烹 · 「{dish.name}」</div>
              ) : (
                <div style={{ color: "#5a3d1a", fontSize: 14.5, fontWeight: "bold", letterSpacing: 2 }}>妙手偶得 · 灶神来起名</div>
              )}
              <div style={{ color: "#7a5a2a", fontSize: 11, marginTop: 3 }}>
                回血 {Math.round(dish.hpRatio * 100)}%（约 {dish.hpDelta} 点）
                {dish.buffs.map((b, i) => <span key={i}> · {b.attr}+{b.val}（{b.turns}回合）</span>)}
                {!dish.name && <span style={{ color: "#9a6a2a" }}> · 菜名风味由灶神即兴</span>}
              </div>
            </div>
          ) : (
            <div style={{ color: "#8a7040", fontSize: 12, fontStyle: "italic" }}>
              {filled.length ? (techOk ? "灶神摇头——这几样凑不成一道菜，换搭配或技法。" : "此技法需换一件能蒸的炊具。") : "卷轴空着，等你下料。"}
            </div>
          )}
        </div>
        {warn && <div className="ck-fadein" style={{ color: "#e0913a", fontSize: 11.5, textAlign: "center", marginTop: 6 }}>{warn}</div>}

        {/* ── ⑤ 开火 / 清空 ── */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", margin: "16px 0 4px" }}>
          <div onClick={fire}
            className="ck-chip"
            style={{ position: "relative", cursor: "pointer", padding: "11px 46px",
              backgroundImage: `url(${UI("btn_blank.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
              color: "#4a2408", fontSize: 16, fontWeight: "bold", letterSpacing: 6,
              opacity: fx?.kind === "ok" ? 0.5 : 1, textShadow: "0 1px 0 rgba(255,255,255,.35)" }}>
            开 火
          </div>
          <div onClick={clearAll}
            className="ck-chip"
            style={{ cursor: "pointer", padding: "11px 22px", display: "flex", alignItems: "center",
              backgroundImage: `url(${UI("bar_wood.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
              color: "#d8c8a0", fontSize: 12.5, letterSpacing: 2, textShadow: "0 1px 2px #000" }}>
            清空
          </div>
        </div>
        <div style={{ color: "#6a5a3a", fontSize: 10.5, textAlign: "center", marginTop: 2, fontStyle: "italic" }}>
          成菜的色香味写进主叙事，点上方「▾ 最小化」即可读这段小总结
        </div>

        {/* ── ⑥ 可用材料 ── */}
        <div style={{ borderTop: "1px solid #3a2c1a", marginTop: 18, paddingTop: 14 }}>
          <div style={{ color: "#a08a5a", fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>🎒 可用材料（点击放入空料槽）</div>
          {mats.length === 0 ? (
            <div style={{ color: "#5a4a30", fontSize: 11.5, fontStyle: "italic" }}>囊中没有食材与调味料。去铺子买、去野外捡，或从 NPC 身上顺一点。</div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {mats.map(m => {
                const left = remaining(m.name);
                const usable = left > 0 && slots.includes(null) && fx?.kind !== "ok";
                return (
                  <div key={m.name} onClick={() => usable && putMaterial(m.name)}
                    className="ck-chip"
                    style={{ cursor: usable ? "pointer" : "default", padding: "6px 13px",
                      backgroundImage: `url(${UI(left > 0 ? "bub_wood1.webp" : "bub_stone.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
                      color: left > 0 ? "#e8d5b0" : "#6a5a40", fontSize: 12, opacity: left > 0 ? 1 : 0.5,
                      textShadow: "0 1px 2px #000" }}>
                      {m.name} <span style={{ color: "#c8a860", fontSize: 10.5 }}>×{left}</span>
                    </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // inline：直接铺在 CenterPanel 的滚动区里（与其他建筑面板同一挂载约定）
  if (inline) return panel;

  // 非 inline：浮层（极少用到，保底）
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.88)", zIndex: 120,
      display: "flex", alignItems: "center", justifyContent: "center" }}
      onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={{ width: 520, maxWidth: "92vw", maxHeight: "86vh", overflowY: "auto",
        border: "1px solid #4a3a20", borderRadius: 0 }} onClick={e => e.stopPropagation()}>
        {panel}
      </div>
    </div>
  );
}
