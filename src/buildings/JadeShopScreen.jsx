import { effectBrief } from "../itemEffectText.js";
import React, { useState } from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";
import { JADE_WARES } from "../items/catalog.js";

// 金玉行：一个 building 两柜台，都消耗背包里的玉料(赌石"据为己有"收来的、带 jadeSpec 的物品)。
// ① 选购成品柜：列 20 种玉器成品(词条预制)，选一块玉料 + 选一件成品 → 打造。
// ② 定制柜：三填空(材料/类别/要求) → 小模型出 3 候选(玉匠语境) → 三选一 → 打造。
// 成品品质 = min(玉料品质天花板, 气运)，在交付时算；这里只预告玉料天花板。
const QUAL_COLOR = { 白: "#e8e4d6", 绿: "#6aaa6a", 蓝: "#5a9adf", 紫: "#b48adf", 橙: "#e0913a", 红: "#d4756a" };
const CAT_CN = { weapon: "玉兵", armor: "玉甲", accessory: "玉饰" };

export default function JadeShopScreen({ building, char, inv = [], time, zoneTheme, onClose, inline, onDesign, onCraft }) {
  const [tab, setTab] = useState("buy");          // buy=选购成品 / custom=定制
  const [jadeId, setJadeId] = useState(null);      // 选中的玉料 id
  const [material, setMaterial] = useState("");
  const [category, setCategory] = useState("");
  const [requirement, setRequirement] = useState("");
  const [designing, setDesigning] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [designErr, setDesignErr] = useState("");
  const luck = (char.special?.气运) ?? 5;

  const pendingFlag = (building?.flags || []).find?.(f => f.startsWith("forge_pending_")) || null;

  // 背包里的玉料(带 jadeSpec 的物品)
  const jades = inv.filter(i => (typeof i === "object") && i.jadeSpec);
  const chosenJade = jades.find(j => j.id === jadeId) || null;

  const inputStyle = { width: "100%", marginTop: 4, marginBottom: 10, background: "#161510", border: `1px solid ${zoneTheme.border}`, borderRadius: 0, color: "#e8e4d6", fontSize: 12, padding: "5px 8px", boxSizing: "border-box" };
  const tabStyle = (on) => ({ flex: 1, textAlign: "center", padding: "6px 0", cursor: "pointer", fontSize: 12, color: on ? "#e0d0a0" : "#8f8a7c", borderBottom: on ? `2px solid ${zoneTheme.accent}` : "1px solid #2a2d3a" });

  async function doDesign() {
    if (designing || !chosenJade) return;
    setDesignErr(""); setDesigning(true); setCandidates(null);
    try {
      const res = await onDesign?.({ material, category, requirement });
      if (res && res.ok && res.candidates?.length) setCandidates(res.candidates);
      else setDesignErr("玉匠端详了半晌，一时没想出合适的样式，换个说法再说说要什么。");
    } catch { setDesignErr("铺子里一时嘈杂，没听真切，再说一遍罢。"); }
    finally { setDesigning(false); }
  }

  function craft(chosen) {
    if (!chosenJade) return;
    onCraft?.(chosen, chosenJade.id, time, { material, requirement });
    setCandidates(null);
  }

  // 玉料选择器（两柜台共用）
  const JadePicker = () => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ color: "#8f8a7c", fontSize: 11, marginBottom: 4 }}>选一块玉料（雕琢会用掉它，成品品质封顶于料的天花板）：</div>
      {jades.length === 0 && <div style={{ color: "#d4756a", fontSize: 11 }}>行囊里没有玉料。去玉石料场赌一块、开出后「据为己有」收进行囊，再来。</div>}
      {jades.map(j => {
        const cap = j.jadeSpec?.qualityCap || j.quality || "白";
        const on = j.id === jadeId;
        return (
          <div key={j.id} onClick={() => setJadeId(j.id)} style={{ cursor: "pointer", padding: "6px 10px", marginBottom: 4, borderRadius: 0, border: `1px solid ${on ? zoneTheme.accent : zoneTheme.border}`, background: on ? "rgba(255,255,255,0.05)" : "transparent", display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#e8e4d6", fontSize: 11.5 }}>{j.jadeSpec?.tierLabel || j.name}</span>
            <span style={{ color: QUAL_COLOR[cap], fontSize: 11 }}>天花板 {cap}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name || "金玉行"} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#8f8a7c", fontSize: 11, marginBottom: 10 }}>{building.desc}</div>
        <div style={{ color: "#8f8a7c", marginBottom: 12, fontSize: 11 }}>气运 {luck}/10 · 玉器品质＝料的天花板与手气取其低</div>

        {pendingFlag && (() => {
          const fp = pendingFlag.split("_");
          const orderedAt = Number(fp[2]);
          const remain = Math.max(0, 24 - Math.max(0, time - (Number.isFinite(orderedAt) ? orderedAt : time)));
          let what = "你定的玉器";
          if (fp[4] && fp[4] !== "-") { try { const s = JSON.parse(decodeURIComponent(fp[4])); if (s?.name) what = `你定的「${s.name}」`; } catch {} }
          return (
            <div style={{ color: "#d4a853", fontSize: 12, padding: "10px 12px", background: "#14100a", borderRadius: 0, border: "1px solid #4a3a1a" }}>
              {remain > 0 ? `${what}正在雕琢，玉匠说还需 ${remain} 个时辰。雕好后自有伙计送来，不必守着。` : `${what}已雕成，伙计正给你送来。`}
            </div>
          );
        })()}

        {!pendingFlag && (
          <>
            <div style={{ display: "flex", marginBottom: 12 }}>
              <div style={tabStyle(tab === "buy")} onClick={() => { setTab("buy"); setCandidates(null); }}>选购成品</div>
              <div style={tabStyle(tab === "custom")} onClick={() => { setTab("custom"); setCandidates(null); }}>拿料定制</div>
            </div>

            <JadePicker />

            {tab === "buy" && (
              <>
                <div style={{ color: "#e8e4d6", fontSize: 12, marginBottom: 8 }}>选一件成品样式，用上面选中的玉料雕（词条已定）：</div>
                {!chosenJade && <div style={{ color: "#8f8a7c", fontSize: 11, marginBottom: 8 }}>先在上面选一块玉料。</div>}
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {JADE_WARES.map((w, i) => {
                    const eff = effectBrief(w.effect, w.sixDim);
                    return (
                      <div key={i} style={{ marginBottom: 8, padding: "8px 10px", background: "#12100c", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#e0d0a0", fontSize: 12.5 }}>{w.name}</span>
                          <span style={{ color: QUAL_COLOR[w.quality], fontSize: 10 }}>{CAT_CN[w.category]}·本档{w.quality}</span>
                        </div>
                        {eff && <div style={{ color: "#8ab4df", fontSize: 10, margin: "3px 0" }}>词条：{eff}</div>}
                        <div style={{ color: "#8a8272", fontSize: 10.5, marginBottom: 6, lineHeight: 1.5 }}>{w.desc}</div>
                        <Btn label={chosenJade ? "用这块料雕它" : "先选玉料"} disabled={!chosenJade} zoneTheme={zoneTheme} onClick={() => craft(w)} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {tab === "custom" && !candidates && (
              <>
                <label style={{ color: "#8f8a7c", fontSize: 11 }}>材料（可留空，默认用所选玉料）</label>
                <input value={material} onChange={e => setMaterial(e.target.value)} placeholder="羊脂玉、帝王绿…" style={inputStyle} />
                <label style={{ color: "#8f8a7c", fontSize: 11 }}>类别（玉饰/玉佩/玉璧/护身…自己写）</label>
                <input value={category} onChange={e => setCategory(e.target.value)} placeholder="饰品·玉佩 / 护甲·玉牌…" style={inputStyle} />
                <label style={{ color: "#8f8a7c", fontSize: 11 }}>要求（想要的脾性，如 幸运、护身、静心…）</label>
                <input value={requirement} onChange={e => setRequirement(e.target.value)} placeholder="幸运、养气…" style={inputStyle} />
                <Btn label={designing ? "玉匠正琢磨样式……" : (chosenJade ? "请玉匠出方案" : "先选玉料")} disabled={designing || !chosenJade} zoneTheme={zoneTheme} onClick={doDesign} />
                {designErr && <div style={{ color: "#d4756a", fontSize: 11, marginTop: 8 }}>{designErr}</div>}
              </>
            )}

            {tab === "custom" && candidates && (
              <>
                <div style={{ color: "#e8e4d6", fontSize: 12, marginBottom: 10 }}>玉匠给出三个样式，选一件雕（用所选玉料）。</div>
                {candidates.map((c, i) => {
                  const eff = effectBrief(c.effect, c.sixDim);
                  return (
                    <div key={i} style={{ marginBottom: 10, padding: "10px 12px", background: "#12100c", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ color: "#e0d0a0", fontSize: 13, fontWeight: "bold" }}>{c.name}</span>
                        <span style={{ color: "#8f8a7c", fontSize: 10 }}>{CAT_CN[c.category] || "玉器"}</span>
                      </div>
                      {eff && <div style={{ color: "#8ab4df", fontSize: 10.5, marginBottom: 4 }}>词条：{eff}</div>}
                      {c.desc && <div style={{ color: "#8a8272", fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>{c.desc}</div>}
                      <Btn label="选这件雕" zoneTheme={zoneTheme} onClick={() => craft(c)} />
                    </div>
                  );
                })}
                <Btn label="都不满意，重说要求" zoneTheme={zoneTheme} onClick={() => setCandidates(null)} />
              </>
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}
