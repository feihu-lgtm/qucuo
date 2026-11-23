// 入册审改 · 随身物编辑
// ============================================================================
// 纯逻辑（特效清单/攻防计算/AI 描述）在 carryItemModel.js，
// 详情面板 ItemDetailPane.jsx、新造面板 ItemForgePane.jsx。

import React, { useState, useMemo } from "react";
import { TIERS, selStyle } from "./widgets.jsx";
import { CATALOG } from "../../../domain/data/items/catalog.js";
import {
  nameOf, blankDraft, fetchAiDesc,
} from "./carryItemModel.js";
import ItemDetailPane from "./ItemDetailPane.jsx";
import ItemForgePane from "./ItemForgePane.jsx";

// ── 随身物 ────────────────────────────────────────────────────────────────────

/**
 * 【默认为空是有意的】卡里没有物品信息，留空时运行时会走 rollNpcCarry 的四池
 * 随机抽（按品阶给武器/护甲/饰品/杂物），不至于两手空空。只有你想精确指定
 * 「这人身上一定有那把刀」时才需要在这儿挑。
 */
export default function CarryPicker({ carry, onChange, levelCap, apiCfg }) {
  const [cat, setCat] = useState("");
  const [qual, setQual] = useState("");
  const [kw, setKw] = useState("");
  const [forging, setForging] = useState(false);   // 是否展开"新造一件"
  const [draft, setDraft] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [detailItem, setDetailItem] = useState(null);   // 点随身物看详情（点名字展开，点 ✕ 才删）

  const cats = useMemo(() => [...new Set(CATALOG.map(e => e.category).filter(Boolean))], []);
  // 【为什么不再 slice(0,60)】百物录现在 406 件（兵器 101 / 护具 59 / 饰物 82 /
  // 杂物 164），原来只渲染前 60 件且不做任何提示——玩家不搜名字就永远翻不到后面
  // 那 346 件，看起来像是"库里只有这些"。406 个条目对 React 不算负担，容器给
  // 滚动条即可，真正需要的是筛得动：类别、品阶、关键词三个维度。
  // 关键词连 desc 一起搜，找"止血的"比记得住药名实用。
  const list = useMemo(() => {
    const k = kw.trim();
    return CATALOG.filter(e =>
      (!cat || e.category === cat)
      && (!qual || e.quality === qual)
      && (!k || e.name.includes(k) || (e.desc || "").includes(k)));
  }, [cat, qual, kw]);

  const has = (name) => carry.some(c => nameOf(c) === name);
  const add = (item) => { if (!has(nameOf(item))) onChange([...carry, item]); };
  const del = (name) => onChange(carry.filter(c => nameOf(c) !== name));
  // 详情/新造都在编辑同一份「物品描述」。改一件已选的自造物：按名字替换回 carry。
  const patchItem = (name, patch) => onChange(carry.map(c =>
    nameOf(c) === name && typeof c === "object" ? { ...c, ...patch } : c));

  const askAiDesc = async () => {
    if (!draft?.name || aiBusy) return;
    setAiBusy(true);
    try {
      const text = await fetchAiDesc(draft, apiCfg);
      if (text) setDraft(d => ({ ...d, desc: text }));
    } catch (e) {
      setDraft(d => ({ ...d, desc: (d.desc || "") + (d.desc ? "" : `（AI 没写出来：${e.message.slice(0, 30)}）`) }));
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7, minHeight: 22 }}>
        {!carry.length && (
          <span style={{ fontSize: 10.5, color: "var(--ink-text-dim)" }}>
            未指定 · 运行时按 {TIERS[levelCap]?.label}档 从四池随机抽
          </span>
        )}
        {carry.map((c, i) => {
          const nm = nameOf(c);
          const custom = typeof c !== "string";
          const open = detailItem && nameOf(detailItem) === nm;
          return (
            <span key={nm + i}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 10.5, padding: "3px 4px 3px 8px", borderRadius: 0,
                border: `1px solid ${open ? "var(--ink-warn)" : custom ? "var(--service-hint)" : "var(--service-card-edge)"}`,
                background: custom ? "rgba(120,180,130,.10)" : "rgba(212,168,83,.10)", color: "var(--paper)",
              }}>
              <span onClick={() => setDetailItem(open ? null : c)} title="点看详情"
                style={{ cursor: "pointer" }}>{custom ? "⚒ " : ""}{nm}</span>
              <span onClick={() => { del(nm); if (open) setDetailItem(null); }} title="移除这件"
                style={{ cursor: "pointer", color: "var(--lore-amber)", fontSize: 11, padding: "0 2px" }}>✕</span>
            </span>
          );
        })}
      </div>

      {detailItem && (
        <ItemDetailPane item={detailItem} onClose={() => setDetailItem(null)} onPatch={patchItem} />
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...selStyle, width: 96 }}>
          <option value="" style={{ background: "var(--bg-deep)" }}>全部类别</option>
          {cats.map(c => <option key={c} value={c} style={{ background: "var(--bg-deep)" }}>{c}</option>)}
        </select>
        <select value={qual} onChange={e => setQual(e.target.value)} style={{ ...selStyle, width: 78 }}>
          <option value="" style={{ background: "var(--bg-deep)" }}>全部品阶</option>
          {TIERS.map(t => (
            <option key={t.label} value={t.label} style={{ background: "var(--bg-deep)", color: t.color }}>{t.label}档</option>
          ))}
        </select>
        <input value={kw} onChange={e => setKw(e.target.value)} placeholder="搜名字或描述"
          style={{ ...selStyle, flex: 1 }} />
        <span onClick={() => { setForging(f => !f); if (!draft) setDraft(blankDraft(cat, levelCap)); }}
          title="造一件百物录里没有的东西"
          style={{
            cursor: "pointer", fontSize: 10.5, padding: "4px 10px", borderRadius: 0, whiteSpace: "nowrap",
            border: `1px solid ${forging ? "var(--green-soft)" : "var(--border-deep)"}`,
            color: forging ? "var(--green-soft)" : "var(--ink-muted)",
          }}>⚒ 新造一件</span>
      </div>

      {forging && draft && (
        <ItemForgePane draft={draft} setDraft={setDraft} cat={cat} levelCap={levelCap}
          apiCfg={apiCfg} aiBusy={aiBusy} onAskAi={askAiDesc}
          onAdd={add} onClose={() => setForging(false)} />
      )}

      {/* 计数条：让"库里到底有多少、我筛掉了多少"始终可见。原来静默截断到 60 件，
          玩家没法知道自己看的是全部还是一角 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "3px 8px",
        fontSize: 9.5, color: "var(--ink-text-dim)", background: "rgba(0,0,0,.3)",
        border: "1px solid var(--bg-card)", borderBottom: "none", borderRadius: 0,
      }}>
        <span>百物录 {CATALOG.length} 件</span>
        {list.length !== CATALOG.length && <span style={{ color: "var(--quest-stage-desc)" }}>· 当前 {list.length} 件</span>}
        <span style={{ flex: 1 }} />
        {carry.length ? <span style={{ color: "var(--ink-warn)" }}>已选 {carry.length}</span> : null}
      </div>

      <div style={{
        maxHeight: "min(38vh, 380px)", overflowY: "auto",
        border: "1px solid var(--bg-card)", borderRadius: "0 0 3px 3px", background: "rgba(0,0,0,.22)",
      }}>
        {!list.length && <div style={{ padding: 8, fontSize: 10.5, color: "var(--ink-text-dim)" }}>没有匹配的物件</div>}
        {list.map(e => {
          const on = has(e.name);
          const tier = TIERS.find(t => t.label === e.quality);
          return (
            <div key={e.name} onClick={() => (on ? del(e.name) : add(e.name))}
              title={e.desc ? e.desc.slice(0, 60) : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 8px",
                cursor: "pointer", fontSize: 10.5,
                background: on ? "rgba(212,168,83,.10)" : "transparent",
                borderBottom: "1px solid var(--gamble-panel)",
              }}>
              <span style={{ color: on ? "var(--ink-warn)" : "var(--gamble-button-edge)", width: 10 }}>{on ? "◉" : "○"}</span>
              <span style={{ color: tier?.color || "var(--quest-stage-desc)", width: 14 }}>{e.quality || "—"}</span>
              <span style={{ color: "var(--ink-text)", flex: 1 }}>{e.name}</span>
              <span style={{ color: "var(--muted)", fontSize: 9.5 }}>{e.category}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
