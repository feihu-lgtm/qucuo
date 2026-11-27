// 图鉴系统 · 百物 · 人物 · 武学总览（夜色精修）
// -----------------------------------------------------------------------------
// 从顶栏「图鉴」打开的全屏覆盖层，整合人物志、百物实物图标与四源武学总录。
import React, { useState, useMemo } from "react";
import { CATALOG } from "../../domain/data/items/catalog.js";
import { CATEGORY_LABEL, QUALITY } from "../../domain/rules/economy/equipment.js";
import { moveCodexBySource, groupMoves, moveCodexStats, MOVE_SOURCE } from "../../domain/data/kungfu/moveCodex.js";
import { ITEM_DISTRIBUTION } from "../../domain/data/items/distribution.js";
import { DISTRICT_REGION } from "../../domain/data/items/regionMap.js";
import { getNpcCodexEntries, getNpcCodexRegions } from "../../domain/data/npc/npcCodex.js";
import { moveEffectBrief, passiveBonusBrief } from "../../domain/rules/economy/itemEffectText.js";
import { QUALITY_COLOR } from "../../domain/data/items/qualityColor.js";
import { Icon } from "../primitives/index.js";
import ModalShell from "../primitives/ModalShell.jsx";
import NpcAvatar from "../components/NpcAvatar.jsx";
import ItemIcon from "../components/ItemIcon.jsx";

const REGION_DISTRICTS = (() => {
  const m = {};
  for (const [district, region] of Object.entries(DISTRICT_REGION)) {
    (m[region] = m[region] || []).push(district);
  }
  return m;
})();

function itemDistText(name) {
  const d = ITEM_DISTRIBUTION[name];
  if (!d) return { kind: "special", text: "奇遇 · 剧情或支线获得，寻常货架无售" };
  const regions = (d.regions || []).map(r => {
    const districts = (REGION_DISTRICTS[r] || []).slice(0, 3);
    return districts.length ? `${r}（${districts.join("、")}）` : r;
  }).join("、");
  const shops = (d.shopTypes || []).join("、");
  return { kind: "shop", text: `${regions || "各地"} 的 ${shops || "店铺"} 有售` };
}

function affectionTierName(v) {
  if (v >= 80) return "亲近";
  if (v >= 60) return "信任";
  if (v >= 40) return "熟络";
  if (v >= 20) return "初识";
  return "陌生";
}

function levelTierLabel(levelCap) {
  return ["白袍", "绿袍", "蓝袍", "紫袍", "橙袍", "红袍"][levelCap] || "白袍";
}

const CAT_FILTERS = [
  { key: "all", label: "全部" },
  { key: "weapon", label: "武器" },
  { key: "armor", label: "护甲" },
  { key: "accessory", label: "饰品" },
  { key: "misc", label: "杂物" },
];
const Q_FILTERS = ["全部", ...QUALITY];
const SRC_TABS = [MOVE_SOURCE.WUGUAN, MOVE_SOURCE.SIGNATURE, MOVE_SOURCE.STANDARD, MOVE_SOURCE.BURDEN];

export default function CodexScreen({ inv = [], skills = [], varTree = {}, onClose }) {
  const [tab, setTab] = useState("npc"); // npc | item | skill
  const [srcTab, setSrcTab] = useState(MOVE_SOURCE.WUGUAN);
  const [catFilter, setCatFilter] = useState("all");
  const [qFilter, setQFilter] = useState("全部");
  const [npcRegion, setNpcRegion] = useState("全部");
  const [metOnly, setMetOnly] = useState(false);
  const [revealAll, setRevealAll] = useState(false);
  const [search, setSearch] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);

  const ownedItems = useMemo(() => new Set(inv.map(i => (typeof i === "string" ? i : i.name))), [inv]);
  const ownedSkills = useMemo(() => new Set(skills.map(s => s.name)), [skills]);

  const metSet = useMemo(() => {
    const set = new Set();
    const w = varTree?.世界 || {};
    for (const n of w.已认识人物 || []) if (n) set.add(n);
    for (const n of w.曾经出现人物 || []) if (n) set.add(n);
    for (const n of w.端详过人物 || []) if (n) set.add(n);
    for (const [n, v] of Object.entries(varTree?.角色 || {})) {
      if (n && typeof v?.好感度 === "number") set.add(n);
    }
    return set;
  }, [varTree]);

  const allNpcs = useMemo(() => getNpcCodexEntries(), []);
  const npcRegions = useMemo(() => getNpcCodexRegions(), []);
  const [selectedNpcName, setSelectedNpcName] = useState(() => allNpcs[0]?.name || null);
  const kw = search.trim();

  const visibleNpcs = useMemo(() => {
    return allNpcs.filter((npc) => {
      if (npcRegion !== "全部" && npc.region !== npcRegion) return false;
      const met = metSet.has(npc.name);
      if (metOnly && !met) return false;
      if (kw && !npc.name.includes(kw) && !npc.region.includes(kw) && !(met && (npc.brief.includes(kw) || npc.bio.includes(kw)))) {
        return false;
      }
      return true;
    });
  }, [allNpcs, npcRegion, metOnly, metSet, kw]);

  const selectedNpc = useMemo(() => {
    return visibleNpcs.find(n => n.name === selectedNpcName)
      || allNpcs.find(n => n.name === selectedNpcName)
      || visibleNpcs[0]
      || allNpcs[0]
      || null;
  }, [visibleNpcs, allNpcs, selectedNpcName]);

  const items = useMemo(() => {
    return CATALOG.filter(it =>
      (catFilter === "all" || it.category === catFilter) &&
      (qFilter === "全部" || it.quality === qFilter) &&
      (!kw || it.name.includes(kw) || (it.desc || "").includes(kw)) &&
      (!ownedOnly || ownedItems.has(it.name))
    );
  }, [catFilter, qFilter, kw, ownedOnly, ownedItems]);

  const codexStats = useMemo(() => moveCodexStats(), []);
  const skillGroups = useMemo(() => {
    const list = (moveCodexBySource()[srcTab] || []).filter(mv =>
      (!kw || mv.name.includes(kw) || (mv.desc || "").includes(kw) || (mv.owner || "").includes(kw)) &&
      (!ownedOnly || ownedSkills.has(mv.name))
    );
    return groupMoves(list).filter(([, l]) => l.length > 0);
  }, [kw, ownedOnly, ownedSkills, srcTab]);

  const itemOwnedCount = useMemo(() => CATALOG.filter(it => ownedItems.has(it.name)).length, [ownedItems]);
  const metCount = useMemo(() => allNpcs.filter(n => metSet.has(n.name)).length, [allNpcs, metSet]);

  const selectedMet = selectedNpc ? metSet.has(selectedNpc.name) : false;
  const selectedLocked = selectedNpc ? (!selectedMet && !revealAll) : true;
  const selectedAttrs = selectedNpc ? (varTree?.角色?.[selectedNpc.name] || {}) : {};
  const selectedAff = typeof selectedAttrs.好感度 === "number" ? selectedAttrs.好感度 : null;
  const selectedLedger = Array.isArray(selectedAttrs.心账) ? selectedAttrs.心账.slice(-4) : [];

  return (
    <ModalShell
      onClose={onClose}
      layer="screen-high"
      showClose={false}
      ariaLabel="百物 · 人物 · 武学总览"
      panelClassName="mobile-codex-panel codex-shell"
    >
      <div className="mobile-overlay-header codex-header">
        <div className="codex-title-wrap">
          <span className="codex-title">百物 · 人物 · 武学总览</span>
          <span className="codex-subtitle">曲措乡人情风物与武学全录</span>
        </div>
        <div className="codex-header-actions">
          <div className="codex-tabs" role="tablist" aria-label="图鉴分类">
            <button type="button" className="codex-tab" data-on={tab === "npc"} onClick={() => setTab("npc")}>人物</button>
            <button type="button" className="codex-tab" data-on={tab === "item"} onClick={() => setTab("item")}>物品</button>
            <button type="button" className="codex-tab" data-on={tab === "skill"} onClick={() => setTab("skill")}>武学</button>
          </div>
          <button type="button" className="mobile-overlay-close codex-close" onClick={onClose} title="合上（也可按 ESC）">× 关闭</button>
        </div>
      </div>

      <div className="codex-search-bar">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === "npc" ? "搜人名、据点或身份…" : "搜名字或介绍…"}
          className="codex-search-input"
        />
        {search && <button type="button" className="codex-clear-btn" onClick={() => setSearch("")}>清空</button>}
        {tab === "npc" ? (
          <>
            <span className="codex-stat-count">已结识 {metCount}/{allNpcs.length}</span>
            <button type="button" className="codex-chip" data-on={metOnly} onClick={() => setMetOnly(v => !v)}>只看已结识</button>
            <button type="button" className="codex-chip" data-on={revealAll} onClick={() => setRevealAll(v => !v)} title="开启后预览尚未谋面的人物真容">
              全览 {revealAll ? "开" : "关"}
            </button>
          </>
        ) : (
          <button type="button" className="codex-chip" data-on={ownedOnly} onClick={() => setOwnedOnly(v => !v)}>
            {ownedOnly ? "✓ 只看已得" : "只看已得"}
          </button>
        )}
      </div>

      {tab === "npc" && (
        <div className="codex-npc-body">
          <div className="codex-npc-left">
            <div className="codex-filter-row">
              {npcRegions.map(region => (
                <button
                  key={region}
                  type="button"
                  className="codex-chip"
                  data-on={npcRegion === region}
                  onClick={() => setNpcRegion(region)}
                >
                  {region}
                </button>
              ))}
            </div>
            <div className="mobile-codex-content codex-npc-grid">
              {visibleNpcs.map((npc) => {
                const met = metSet.has(npc.name);
                const locked = !met && !revealAll;
                const aff = typeof varTree?.角色?.[npc.name]?.好感度 === "number" ? varTree.角色[npc.name].好感度 : null;
                return (
                  <button
                    key={npc.name}
                    type="button"
                    className="codex-npc-card"
                    data-on={selectedNpc?.name === npc.name}
                    onClick={() => setSelectedNpcName(npc.name)}
                  >
                    <NpcAvatar name={npc.name} size="xl" locked={locked} />
                    <div className="codex-npc-name">{locked ? "？？？" : npc.name}</div>
                    <div className="codex-npc-meta">
                      {npc.region}
                      {aff != null && !locked ? ` · ${affectionTierName(aff)} ${aff}` : (!npc.hasArt && !locked ? " · 暂无小像" : "")}
                    </div>
                  </button>
                );
              })}
              {visibleNpcs.length === 0 && <div className="codex-empty">无匹配人物</div>}
            </div>
          </div>

          {selectedNpc && (
            <aside className="codex-npc-detail">
              <div className="codex-detail-hero">
                <NpcAvatar name={selectedNpc.name} size="dossier" locked={selectedLocked} />
                <div className="codex-detail-name">{selectedLocked ? "未谋面之人" : selectedNpc.name}</div>
                <div className="codex-detail-sub">
                  {selectedNpc.region} · {selectedLocked ? "行踪未明" : (selectedNpc.brief || "江湖中人")}
                  {!selectedLocked && <span className="codex-tier-pill">{levelTierLabel(selectedNpc.levelCap)}</span>}
                </div>
              </div>

              {!selectedLocked && selectedAff != null && (
                <div className="codex-detail-aff">
                  <div className="codex-detail-aff-row">
                    <span>好感 · {affectionTierName(selectedAff)}</span>
                    <span>{selectedAff}/100</span>
                  </div>
                  <div className="night-bar"><div className="night-bar-fill night-bar-fill--good" style={{ width: `${Math.min(100, selectedAff)}%` }} /></div>
                </div>
              )}

              <div className="codex-detail-bio">
                {selectedLocked ? "尚未在江湖中正面相逢。可打开上方「全览」查看全部人物小像。" : (selectedNpc.bio || selectedNpc.brief || "暂未记入详细生平。")}
              </div>

              {!selectedLocked && selectedNpc.carry?.length > 0 && (
                <div className="codex-detail-section">
                  <div className="panel-sec-label">随身所携</div>
                  <div className="codex-tag-wrap">
                    {selectedNpc.carry.slice(0, 6).map((c, idx) => (
                      <span key={idx} className="codex-mini-tag">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {!selectedLocked && selectedLedger.length > 0 && (
                <div className="codex-detail-section">
                  <div className="panel-sec-label">心账近期</div>
                  {selectedLedger.map((entry, idx) => (
                    <div key={entry.id || idx} className="codex-ledger-item">
                      [{entry.tag || entry.kind || "见"}] {entry.summary || entry.reason}
                    </div>
                  ))}
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {tab === "item" && (
        <div className="codex-list-body">
          <div className="codex-filter-bar">
            <div className="codex-filter-row">
              <span className="codex-filter-label">类别</span>
              {CAT_FILTERS.map(c => (
                <button key={c.key} type="button" className="codex-chip" data-on={catFilter === c.key} onClick={() => setCatFilter(c.key)}>{c.label}</button>
              ))}
            </div>
            <div className="codex-filter-row">
              <span className="codex-filter-label">品阶</span>
              {Q_FILTERS.map(q => (
                <button key={q} type="button" className="codex-chip" data-on={qFilter === q} onClick={() => setQFilter(q)}>{q}</button>
              ))}
            </div>
          </div>
          <div className="mobile-codex-content codex-scroll-list">
            <div className="codex-list-summary">共 {items.length} 件 · 已收录 {itemOwnedCount}/{CATALOG.length}</div>
            {items.map((it, i) => <ItemRow key={it.name + i} it={it} owned={ownedItems.has(it.name)} />)}
            {items.length === 0 && <div className="codex-empty">{ownedOnly ? "尚无已获得的物件" : "此类暂无记载"}</div>}
          </div>
        </div>
      )}

      {tab === "skill" && (
        <div className="codex-list-body">
          <div className="codex-filter-row codex-filter-bar">
            {SRC_TABS.map(src => (
              <button key={src} type="button" className="codex-chip" data-on={srcTab === src} onClick={() => setSrcTab(src)}>
                {src}·{codexStats.bySource[src] || 0}
              </button>
            ))}
          </div>
          <div className="mobile-codex-content codex-scroll-list">
            <div className="codex-list-summary">全图共 {codexStats.total} 招 · 本页 {skillGroups.reduce((n, [, l]) => n + l.length, 0)} 招</div>
            {skillGroups.map(([grp, list]) => (
              <div key={grp}>
                <div className="codex-skill-group">{grp}</div>
                {list.map((sk, i) => <SkillRow key={sk.id || i} sk={sk} owned={ownedSkills.has(sk.name)} />)}
              </div>
            ))}
            {skillGroups.length === 0 && <div className="codex-empty">{ownedOnly ? "尚未习得任何武学" : "无匹配武学"}</div>}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function ItemRow({ it, owned }) {
  const qc = QUALITY_COLOR[it.quality] || "var(--text-dim)";
  const statBits = [];
  if (it.atkMul) statBits.push(`攻·倍率${it.atkMul}`);
  if (it.defMul) statBits.push(`防·倍率${it.defMul}`);
  if (it.sixDim) statBits.push(Object.entries(it.sixDim).map(([k, v]) => `${k}+${v}`).join(" "));
  const effectName = it.effect && typeof it.effect === "object"
    ? (Object.values(it.effect).find(v => v && v.name)?.name || "特效")
    : null;
  const dist = itemDistText(it.name);
  return (
    <div className="codex-entry-row" data-owned={Boolean(owned)}>
      <div className="codex-entry-thumb">
        <ItemIcon item={it} size="lg" fallbackIcon="饰品" dim={!owned} />
        {owned && <span className="codex-owned-mark" aria-label="已获得">✓</span>}
      </div>
      <div className="codex-entry-main">
        <div className="codex-entry-head">
          <span className="codex-entry-name" style={{ color: qc }}>{it.name}</span>
          <span className="codex-entry-quality" style={{ color: qc }}>{it.quality}</span>
          <span className="codex-entry-cat">{CATEGORY_LABEL[it.category] || it.category}</span>
          {statBits.length > 0 && <span className="codex-entry-stat">{statBits.join(" · ")}</span>}
          {effectName && <span className="codex-entry-stat">· {effectName}</span>}
          {owned && <span className="codex-entry-owned">· 已获得</span>}
        </div>
        {it.desc && <div className="codex-entry-desc">{it.desc}</div>}
        <div className="codex-entry-dist" data-special={dist.kind === "special"}>{dist.text}</div>
      </div>
    </div>
  );
}

function SkillRow({ sk, owned }) {
  const qc = QUALITY_COLOR[sk.quality] || "var(--text-dim)";
  const bonusBits = [];
  if (sk.owner) bonusBits.push(`${sk.owner}·${sk.slot || ""}`);
  if (sk.skillType) bonusBits.push(sk.skillType + (sk.type ? `·${sk.type}` : ""));
  else if (sk.type) bonusBits.push(`招式·${sk.type}`);
  if (sk.unlearnable) bonusBits.push("不可学");
  const pb = passiveBonusBrief(sk.passiveBonus);
  if (pb) bonusBits.push(pb);
  const fx = moveEffectBrief(sk);
  if (fx) bonusBits.push(fx);
  const iconName = sk.skillType || sk.type || "招式";
  return (
    <div className="codex-entry-row" data-owned={Boolean(owned)}>
      <div className="codex-entry-thumb codex-entry-thumb--svg">
        <Icon name={iconName} size={20} />
        {owned && <span className="codex-owned-mark" aria-label="已习得">✓</span>}
      </div>
      <div className="codex-entry-main">
        <div className="codex-entry-head">
          <span className="codex-entry-name" style={{ color: qc }}>{sk.name}</span>
          <span className="codex-entry-quality" style={{ color: qc }}>{sk.quality}</span>
          <span className="codex-entry-cat">{sk.type}</span>
          {typeof sk.price === "number" && <span className="codex-entry-stat">{sk.price} 两</span>}
          {owned && <span className="codex-entry-owned">· 已习得</span>}
        </div>
        {bonusBits.length > 0 && <div className="codex-entry-dist">{bonusBits.join(" · ")}</div>}
        {sk.desc && <div className="codex-entry-desc">{sk.desc}</div>}
      </div>
    </div>
  );
}
