import { effectBrief } from "../itemEffectText.js";
import React, { useState } from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

// 铁匠铺/铸剑坊：拿料定制。玩家填【材料/类别/要求】三栏 → 点"求个方案"→ 小模型出 3 个候选
// 成品(名字/类别/词条/描述) → 三选一 → 选定才扣定金下单 → 约24时辰后自动送货入袋。
// 品质由系统按气运定(此处只预告一个基于气运的大致品阶)，词条由小模型据"要求"从全集里选。
const QUAL_COLOR = { 白: "#c8bfa0", 绿: "#6aaa6a", 蓝: "#5a9adf", 紫: "#b48adf", 橙: "#e0913a", 红: "#d4756a" };
const CAT_CN = { weapon: "武器", armor: "护甲", accessory: "饰品" };

export default function ForgeScreen({ building, char, time, flags, zoneTheme, onClose, inline, onCommission, onDesign }) {
  const [material, setMaterial] = useState("");
  const [category, setCategory] = useState("");
  const [requirement, setRequirement] = useState("");
  const [designing, setDesigning] = useState(false);   // 小模型出方案中
  const [candidates, setCandidates] = useState(null);   // 3 个候选，null=未设计
  const [designErr, setDesignErr] = useState("");
  const money = char.money || 0;
  const luck = (char.special?.气运) ?? 5;
  const FORGE_COST = 120;

  // 是否有在造订单。打好后主循环自动送货入袋，不再有取件态，只看 pending。
  const pendingFlag = flags.find(f => f.startsWith("forge_pending_"));

  // 气运预告品阶（与自动交付的 luck→quality 同一档表，仅作预告，实际以交付时为准）
  const qualities = ["白", "绿", "蓝", "紫", "橙"];
  const previewQuality = qualities[Math.min(qualities.length - 1, Math.floor(luck / 2.5))];

  const inputStyle = { width: "100%", marginTop: 4, marginBottom: 10, background: "#10121a", border: `1px solid ${zoneTheme.border}`, borderRadius: 4, color: "#c8bfa0", fontSize: 12, padding: "5px 8px", boxSizing: "border-box" };

  async function doDesign() {
    if (designing) return;
    setDesignErr(""); setDesigning(true); setCandidates(null);
    try {
      const res = await onDesign?.({ material, category, requirement });
      if (res && res.ok && res.candidates?.length) setCandidates(res.candidates);
      else setDesignErr("铁匠皱眉想了半晌，一时没琢磨出合适的样式，不妨换个说法再说说要什么。");
    } catch (e) {
      setDesignErr("铁匠铺里一时嘈杂，没听真切，再说一遍罢。");
    } finally {
      setDesigning(false);
    }
  }

  function chooseCandidate(c) {
    if (money < FORGE_COST) return;
    onCommission?.(c, luck, time, FORGE_COST, { material, requirement });
    // 选定即下单，面板交给 pending 态（onCommission 内部会加 pending flag，父组件重渲染后
    // pendingFlag 生效）；这里顺手清掉候选，避免残留。
    setCandidates(null);
  }

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name || "铁匠铺"} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#7a7a6a", fontSize: 11, marginBottom: 12 }}>{building.desc}</div>
        <div style={{ color: "#8a8a7a", marginBottom: 12, fontSize: 11 }}>
          银两 {money} 两 · 气运 {luck}/10 · 定制费 {FORGE_COST} 两 · 预估品阶 <span style={{ color: QUAL_COLOR[previewQuality] }}>{previewQuality}</span>（以交付为准，有浮动）
        </div>

        {pendingFlag && (() => {
          const fp = pendingFlag.split("_");
          const orderedAt = Number(fp[2]);
          const elapsed = Number.isFinite(orderedAt) ? Math.max(0, time - orderedAt) : 0;
          const remain = Math.max(0, 24 - elapsed);
          let what = "你定制的物件";
          if (fp[4] && fp[4] !== "-") {
            try { const s = JSON.parse(decodeURIComponent(fp[4])); if (s?.name) what = `你定制的「${s.name}」`; } catch { /* 老格式忽略 */ }
          }
          return (
            <div style={{ color: "#d4a853", fontSize: 12, padding: "10px 12px", background: "#14100a", borderRadius: 6, border: "1px solid #4a3a1a" }}>
              {remain > 0
                ? `${what}正在赶工，铁匠说还需 ${remain} 个时辰方能打成。打好后自有伙计寻来送到你手上，不必守在这里。`
                : `${what}已打成，铺子里的伙计正给你送来，稍候便到手上。`}
            </div>
          );
        })()}

        {!pendingFlag && !candidates && (
          <>
            <div style={{ color: "#c8bfa0", fontSize: 12, marginBottom: 10 }}>拿料定制，说清要什么，铁匠给你出几个样式挑。</div>
            <label style={{ color: "#7a7a6a", fontSize: 11 }}>材料（如 陨铁、玄冰精铁，可留空任铁匠择料）</label>
            <input value={material} onChange={e => setMaterial(e.target.value)} placeholder="陨铁…" style={inputStyle} />
            <label style={{ color: "#7a7a6a", fontSize: 11 }}>类别（武器·刀/枪/剑/戟 或 护甲 或 饰品，自己写）</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="武器·长枪 / 护甲·护腕 / 饰品·扳指…" style={inputStyle} />
            <label style={{ color: "#7a7a6a", fontSize: 11 }}>要求（想要的脾性，如 锋利、幸运、护身、轻捷…）</label>
            <input value={requirement} onChange={e => setRequirement(e.target.value)} placeholder="锋利、破甲…" style={inputStyle} />
            <Btn label={designing ? "铁匠正琢磨样式……" : "请铁匠出方案"} disabled={designing} zoneTheme={zoneTheme} onClick={doDesign} />
            {designErr && <div style={{ color: "#d4756a", fontSize: 11, marginTop: 8 }}>{designErr}</div>}
            <div style={{ color: "#4a4a4a", fontSize: 10, marginTop: 10 }}>出方案不花钱，选定一件才付 {FORGE_COST} 两定金。约 24 时辰后打成、伙计送货上门。</div>
          </>
        )}

        {!pendingFlag && candidates && (
          <>
            <div style={{ color: "#c8bfa0", fontSize: 12, marginBottom: 10 }}>铁匠给出三个样式，选一件定下（付 {FORGE_COST} 两定金）。</div>
            {candidates.map((c, i) => {
              const eff = effectBrief(c.effect, c.sixDim);
              return (
                <div key={i} style={{ marginBottom: 10, padding: "10px 12px", background: "#12100c", borderRadius: 6, border: `1px solid ${zoneTheme.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ color: "#e0d0a0", fontSize: 13, fontWeight: "bold" }}>{c.name}</span>
                    <span style={{ color: "#7a7a6a", fontSize: 10 }}>{CAT_CN[c.category] || "武器"}</span>
                  </div>
                  {eff && <div style={{ color: "#8ab4df", fontSize: 10.5, marginBottom: 4 }}>词条：{eff}</div>}
                  {c.desc && <div style={{ color: "#8a8272", fontSize: 11, marginBottom: 8, lineHeight: 1.5 }}>{c.desc}</div>}
                  <Btn label={money < FORGE_COST ? "银两不足" : `选这件（${FORGE_COST}两）`} disabled={money < FORGE_COST} zoneTheme={zoneTheme} onClick={() => chooseCandidate(c)} />
                </div>
              );
            })}
            <div style={{ marginTop: 6 }}>
              <Btn label="都不满意，重说要求" zoneTheme={zoneTheme} onClick={() => setCandidates(null)} />
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}
