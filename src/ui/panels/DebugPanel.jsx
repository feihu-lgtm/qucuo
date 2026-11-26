import { useState } from "react";
import { OVERLAY, closeOverlay } from "../../store/uiStore.js";
import { QUCUO_MAP, getMapNode } from "../../domain/data/map/qucuoMap.js";
import { getInnerRoomNames, isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";
import { markNpcAsKnown } from "../../domain/rules/npc/npcAwareness.js";
import { SKILL_CATALOG, makeSkillEntry } from "../../domain/data/kungfu/qucuoKungfu.js";
import { CATALOG, CATALOG_INDEX, makeCatalogItem } from "../../domain/data/items/catalog.js";
import { CATEGORY_LABEL, makeItem } from "../../domain/rules/economy/equipment.js";
import { reputationLabel } from "../format/reputation.js";

export default function DebugPanel({
  isMobile,
  char, setChar,
  pot, setPot, exp, setExp,
  dao, setDao,
  varTree, setVarTree,
  narrator, setNarrator,
  room, innerRoomName,
  mapData, setMapData, setRoom, setInnerRoomName,
  addLog, setInteractMode, act,
  teleportLookRef,
  setSkills, setInv,
}) {
  const [dbgFav, setDbgFav] = useState("");
  const [dbgDist, setDbgDist] = useState("");
  const [dbgInner, setDbgInner] = useState("");
  const [dbgSkillType, setDbgSkillType] = useState("全部");
  const [dbgSkillQuality, setDbgSkillQuality] = useState("全部");
  const [dbgItemName, setDbgItemName] = useState("");
  const [dbgItemCat, setDbgItemCat] = useState("weapon");
  const [dbgItemQuality, setDbgItemQuality] = useState("白");
  const [dbgPickedSkill, setDbgPickedSkill] = useState("");
  const [dbgItemCatF, setDbgItemCatF] = useState("全部");
  const [dbgItemQualF, setDbgItemQualF] = useState("全部");
  const [dbgPickedItem, setDbgPickedItem] = useState("");

  const inp = { background: "var(--bg-panel)", border: "1px solid var(--ink-edge-quest)", color: "var(--text)", borderRadius: 0, padding: "2px 5px", fontSize: "var(--fs-xs)" };
  const lbl = { color: "var(--accent)", flexShrink: 0 };

  return (
    // 手机端贴底浮出：定位与层级在 tokens.css 的 .debug-panel-dock（--z-screen-high）。
    <div className={isMobile ? "debug-panel-dock" : undefined} style={isMobile
      ? { padding: "10px 14px",
          borderTop: `1px solid var(--border)`, background: "rgba(12,14,20,.98)", fontSize: "var(--fs-xs)", color: "var(--debug-text)",
          display: "flex", flexDirection: "column", gap: 8, maxHeight: "70vh", overflowY: "auto", overflowX: "auto",
          WebkitOverflowScrolling: "touch", boxShadow: "0 -8px 30px rgba(0,0,0,.7)" }
      : { flexShrink: 0, padding: "10px 14px", borderBottom: `1px solid var(--border)`, background: "rgba(110,198,198,0.05)", fontSize: "var(--fs-xs)", color: "var(--debug-text)", display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "space-between",
        margin: "-10px -14px 4px", padding: "6px 14px", background: "rgba(16,18,26,.96)", borderBottom: "1px solid var(--ink-edge-quest)" }}>
        <span style={{ color: "var(--accent)", fontSize: "var(--fs-sm)", fontWeight: "bold" }}>🛠 调试面板</span>
        <span className="debug-close-btn" onClick={() => closeOverlay(OVERLAY.DEBUG)}>✕ 关闭</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 40, ...lbl }}>金钱</span>
        <input type="number" value={char.money ?? 0}
          onChange={e => setChar(c => ({ ...c, money: parseInt(e.target.value) || 0 }))}
          style={{ width: 90, ...inp }} />
        <span style={{ width: 40, ...lbl, marginLeft: 8 }}>气血</span>
        <input type="number" value={char.hp?.[0] ?? 0}
          onChange={e => setChar(c => ({ ...c, hp: [parseInt(e.target.value) || 0, c.hp?.[1] ?? 100] }))}
          style={{ width: 60, ...inp }} />
        <span style={{ fontSize: "var(--fs-2xs)" }}>/</span>
        <input type="number" value={char.hp?.[1] ?? 100}
          onChange={e => setChar(c => ({ ...c, hp: [c.hp?.[0] ?? 0, parseInt(e.target.value) || 100] }))}
          style={{ width: 60, ...inp }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 40, ...lbl }}>外功</span>
        <input type="number" min={0} max={100} value={char.waigong ?? 0}
          onChange={e => setChar(c => ({ ...c, waigong: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
          style={{ width: 90, ...inp }} />
        <span style={{ width: 40, ...lbl, marginLeft: 8 }}>内功</span>
        <input type="number" min={0} max={100} value={char.neigong ?? 0}
          onChange={e => setChar(c => ({ ...c, neigong: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) }))}
          style={{ width: 90, ...inp }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ width: 40, ...lbl }}>七维</span>
        {["根骨", "悟性", "体魄", "魅力", "智谋", "身法", "气运"].map(dim => (
          <span key={dim} style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: "var(--fs-2xs)" }}>{dim}</span>
            <input type="number" value={char.special?.[dim] ?? 5}
              onChange={e => setChar(c => ({ ...c, special: { ...(c.special || {}), [dim]: parseInt(e.target.value) || 0 } }))}
              style={{ width: 42, background: "var(--bg-panel)", border: "1px solid var(--ink-edge-quest)", color: "var(--text)", borderRadius: 0, padding: "2px 4px", fontSize: "var(--fs-xs)" }} />
          </span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--fs-2xs)" }}>潜能</span>
        <input type="number" value={pot ?? 0}
          onChange={e => setPot(parseInt(e.target.value) || 0)}
          style={{ width: 55, background: "var(--bg-panel)", border: "1px solid var(--ink-edge-quest)", color: "var(--text)", borderRadius: 0, padding: "2px 4px", fontSize: "var(--fs-xs)" }} />
        <span style={{ fontSize: "var(--fs-2xs)", marginLeft: 6 }}>阅历</span>
        <input type="number" value={exp ?? 0}
          onChange={e => setExp(parseInt(e.target.value) || 0)}
          style={{ width: 55, background: "var(--bg-panel)", border: "1px solid var(--ink-edge-quest)", color: "var(--text)", borderRadius: 0, padding: "2px 4px", fontSize: "var(--fs-xs)" }} />
        <span style={{ fontSize: "var(--fs-2xs)", marginLeft: 6 }}>因果</span>
        <input type="number" value={dao.karma ?? 0}
          onChange={e => setDao(d => ({ ...d, karma: parseInt(e.target.value) || 0 }))}
          style={{ width: 55, background: "var(--bg-panel)", border: "1px solid var(--ink-edge-quest)", color: "var(--text)", borderRadius: 0, padding: "2px 4px", fontSize: "var(--fs-xs)" }} />
        <span style={{ fontSize: "var(--fs-2xs)", marginLeft: 6 }}>劫数</span>
        <input type="number" value={dao.jie ?? 0}
          onChange={e => setDao(d => ({ ...d, jie: parseInt(e.target.value) || 0 }))}
          style={{ width: 55, background: "var(--bg-panel)", border: "1px solid var(--ink-edge-quest)", color: "var(--text)", borderRadius: 0, padding: "2px 4px", fontSize: "var(--fs-xs)" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 40, ...lbl }}>威望</span>
        <input type="number" value={varTree.世界?.威望 ?? 0}
          onChange={e => { const v = parseInt(e.target.value) || 0; setVarTree(prev => ({ ...prev, 世界: { ...(prev.世界 || {}), 威望: v } })); }}
          style={{ width: 70, ...inp }} />
        <span style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)" }}>{reputationLabel(varTree.世界?.威望 ?? 0)}（全局总值，不分势力）</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 70, ...lbl }}>旁白好感</span>
        <input type="number" value={narrator.affection ?? 0}
          onChange={e => setNarrator(n => ({ ...n, affection: parseInt(e.target.value) || 0 }))}
          style={{ width: 70, ...inp }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 40, ...lbl }}>好感</span>
        <select value={dbgFav} onChange={e => setDbgFav(e.target.value)}
          style={{ ...inp, maxWidth: 130 }}>
          <option value="">选认识的人…</option>
          {(varTree.世界?.已认识人物 || []).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {dbgFav && (
          <input type="number" value={varTree.角色?.[dbgFav]?.好感度 ?? 0}
            onChange={e => { const v = parseInt(e.target.value) || 0; setVarTree(prev => ({ ...prev, 角色: { ...(prev.角色 || {}), [dbgFav]: { ...((prev.角色 || {})[dbgFav] || {}), 好感度: v } } })); }}
            style={{ width: 70, ...inp }} />
        )}
        {!(varTree.世界?.已认识人物 || []).length && <span style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)" }}>（还没认识任何人）</span>}
        <span
          onClick={() => {
            const visible = room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));
            if (!visible.length) { addLog([{ t: "sys", text: "  [调试] 当前房间没有可见的在场者" }]); return; }
            setVarTree(prev => visible.reduce((tree, n) => markNpcAsKnown(tree, n.name), prev));
            addLog([{ t: "sys", text: `  [调试] 已认识在场者：${visible.map(n => n.name).join("、")}` }]);
          }}
          className="debug-action"
        >认识在场者</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ width: 40, ...lbl }}>传送</span>
        <select value={dbgDist} onChange={e => { setDbgDist(e.target.value); setDbgInner(""); }}
          style={inp}>
          <option value="">大地点…</option>
          {Object.keys(QUCUO_MAP).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {dbgDist && getInnerRoomNames(dbgDist).length > 0 && (
          <select value={dbgInner} onChange={e => setDbgInner(e.target.value)}
            style={inp}>
            <option value="">小地点（可选）…</option>
            {getInnerRoomNames(dbgDist).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <span onClick={() => {
          if (!dbgDist) return;
          const node = getMapNode(dbgDist); if (!node) return;
          const same = dbgDist === room.name;
          if (!same) {
            setRoom({ name: dbgDist, desc: node.desc, exits: Object.keys(node.exits), npcs: [], items: [] });
            if (!mapData[dbgDist]) setMapData(m => ({ ...m, [dbgDist]: { x: node.x, y: node.y } }));
          }
          if (dbgInner) {
            if (same) setInnerRoomName(dbgInner);
            else setTimeout(() => setInnerRoomName(dbgInner), 0);
          }
          addLog([{ t: "sys", text: `  [调试] 传送 → ${dbgDist}${dbgInner ? "·" + dbgInner : ""}` }]);
          const inner2 = dbgInner || null;
          if (same && (inner2 === innerRoomName || (!inner2))) {
            setInteractMode("action"); act("环顾四周");
          } else {
            teleportLookRef.current = { dist: dbgDist, inner: inner2 };
          }
        }}
          className="debug-action debug-action-accent" data-on={Boolean(dbgDist)}>传送</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ width: 40, ...lbl }}>增加武学</span>
        <select value={dbgSkillType} onChange={e => { setDbgSkillType(e.target.value); setDbgPickedSkill(""); }}
          style={inp}>
          <option value="全部">全部类型</option>
          <option value="招式">招式</option>
          <option value="内功">内功</option>
          <option value="轻功">轻功</option>
        </select>
        <select value={dbgSkillQuality} onChange={e => { setDbgSkillQuality(e.target.value); setDbgPickedSkill(""); }}
          style={inp}>
          <option value="全部">全部品阶</option>
          {["白","绿","蓝","紫","橙","红"].map(q => <option key={q} value={q}>{q}</option>)}
        </select>
        <select value={dbgPickedSkill} onChange={e => setDbgPickedSkill(e.target.value)}
          style={{ ...inp, minWidth: 120 }}>
          <option value="">选武学…</option>
          {(() => {
            const all = Object.values(SKILL_CATALOG).flat();
            const filtered = all.filter(s =>
              (dbgSkillType === "全部" || s.type === dbgSkillType) &&
              (dbgSkillQuality === "全部" || s.quality === dbgSkillQuality)
            );
            return filtered.map(s => <option key={s.id} value={s.id}>{s.name}（{s.quality}·{s.type}）</option>);
          })()}
        </select>
        <span onClick={() => {
          if (!dbgPickedSkill) return;
          const all = Object.values(SKILL_CATALOG).flat();
          const found = all.find(s => s.id === dbgPickedSkill);
          if (!found) return;
          const entry = makeSkillEntry(found);
          entry.active = true;
          setSkills(sk => [...sk, entry]);
          addLog([{ t: "sys", text: `  [调试] 习得并运功「${found.name}」（${found.quality}·${found.type}）` }]);
        }}
          className="debug-action" data-on={Boolean(dbgPickedSkill)}
        >增加并装备</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ width: 40, ...lbl }}>目录物</span>
        <select value={dbgItemCatF} onChange={e => { setDbgItemCatF(e.target.value); setDbgPickedItem(""); }}
          style={inp}>
          <option value="全部">全部类别</option>
          {["weapon","armor","accessory","misc"].map(c => <option key={c} value={c}>{CATEGORY_LABEL[c] || c}</option>)}
        </select>
        <select value={dbgItemQualF} onChange={e => { setDbgItemQualF(e.target.value); setDbgPickedItem(""); }}
          style={inp}>
          <option value="全部">全部品阶</option>
          {["白","绿","蓝","紫","橙","红"].map(q => <option key={q} value={q}>{q}</option>)}
        </select>
        <select value={dbgPickedItem} onChange={e => setDbgPickedItem(e.target.value)}
          style={{ ...inp, minWidth: 120 }}>
          <option value="">选物品…</option>
          {CATALOG.filter(it =>
            (dbgItemCatF === "全部" || it.category === dbgItemCatF) &&
            (dbgItemQualF === "全部" || it.quality === dbgItemQualF)
          ).map(it => <option key={it.name} value={it.name}>{it.name}（{it.quality}·{CATEGORY_LABEL[it.category] || it.category}）</option>)}
        </select>
        <span onClick={() => {
          if (!dbgPickedItem) return;
          const entry = CATALOG_INDEX[dbgPickedItem];
          if (!entry) return;
          const item = makeCatalogItem(entry);
          setInv(v => [...v, item]);
          addLog([{ t: "sys", text: `  [调试] 获得「${item.name}」（${item.quality}·${CATEGORY_LABEL[item.category] || item.category}）` }]);
          setDbgPickedItem("");
        }}
          className="debug-action" data-on={Boolean(dbgPickedItem)}
        >增加</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ width: 40, ...lbl }}>自定义</span>
        <input type="text" value={dbgItemName} onChange={e => setDbgItemName(e.target.value)} placeholder="物品名"
          style={{ width: 100, ...inp }} />
        <select value={dbgItemCat} onChange={e => setDbgItemCat(e.target.value)}
          style={inp}>
          {["weapon","armor","accessory","misc"].map(c => <option key={c} value={c}>{CATEGORY_LABEL[c] || c}</option>)}
        </select>
        <select value={dbgItemQuality} onChange={e => setDbgItemQuality(e.target.value)}
          style={inp}>
          {["白","绿","蓝","紫","橙","红"].map(q => <option key={q} value={q}>{q}</option>)}
        </select>
        <span onClick={() => {
          if (!dbgItemName.trim()) return;
          const item = makeItem({ name: dbgItemName.trim(), category: dbgItemCat, quality: dbgItemQuality });
          setInv(v => [...v, item]);
          addLog([{ t: "sys", text: `  [调试] 获得「${item.name}」（${item.quality}·${CATEGORY_LABEL[dbgItemCat] || dbgItemCat}）` }]);
          setDbgItemName("");
        }}
          className="debug-action" data-on={Boolean(dbgItemName.trim())}
        >增加</span>
      </div>
    </div>
  );
}
