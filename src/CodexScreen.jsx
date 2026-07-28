// 图鉴系统 · 百物·武学总览
// -----------------------------------------------------------------------------
// 从顶栏「📖 图鉴」打开的全屏覆盖层，一站看全游戏里所有物品与武学的介绍、品阶、
// 效果与分布。纯展示层：只读 catalog.js / qucuoKungfu.js 的现成数据，不改任何状态。
//
// 视觉：复用赌石那套 public/stones/ 素材（panel_big 卷轴纸面板、bar_wood/bar_paper
// 标签、jade_1~6 品阶玉石），风格与赌石一致。品阶玉石在这里作"稀有度标记"——一颗
// 玉的颜色替代图标（一把剑配圆宝石图标会怪，配一颗"这东西什么档次"的玉石才通顺）。
//
// 无图标素材问题的解法就在这：不做图标墙，用品阶玉石 + 品阶色 + 排版撑质感。

import React, { useState, useMemo, useEffect } from "react";
import { CATALOG } from "./items/catalog.js";
import { CATEGORY_LABEL, QUALITY, QUALITY_COLOR } from "./equipment.js";
import { moveCodexBySource, groupMoves, moveCodexStats, MOVE_SOURCE } from "./kungfu/moveCodex.js";
import { ITEM_DISTRIBUTION, isPoolable } from "./items/distribution.js";
import { DISTRICT_REGION } from "./items/regionMap.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
const S = (f) => `${BASE}stones/${f}`;

// 地域 → 该地域下的具体据点名（DISTRICT_REGION 的反向索引），供分布说明落到据点
const REGION_DISTRICTS = (() => {
  const m = {};
  for (const [district, region] of Object.entries(DISTRICT_REGION)) {
    (m[region] = m[region] || []).push(district);
  }
  return m;
})();

// 把一件物品的分布信息翻成人话：
//   在 ITEM_DISTRIBUTION 里（可上架货）→「在<地域>(据点)的<店类>有售」
//   不在表里（神兵/传说/剧情信物/任务物）→「奇遇·剧情或支线获得，不上货架」
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

// 品阶 → 玉石图代号（对应 public/stones/jade_N_色_chun.webp）
const JADE_CODE = { 白: ["1", "bai"], 绿: ["2", "lv"], 蓝: ["3", "lan"], 紫: ["4", "zi"], 橙: ["5", "cheng"], 红: ["6", "hong"] };
const jadeSrc = (q) => { const c = JADE_CODE[q]; return c ? S(`jade_${c[0]}_${c[1]}_chun.webp`) : null; };

// 物品类别筛选项：全部 + 四大类 + 两个特殊层（传说/神兵按 tags/标记区分）
const CAT_FILTERS = [
  { key: "all", label: "全部" },
  { key: "weapon", label: "武器" },
  { key: "armor", label: "护甲" },
  { key: "accessory", label: "饰品" },
  { key: "misc", label: "杂物" },
];
const Q_FILTERS = ["全部", ...QUALITY];

// 武学来源分页。分组名与归一逻辑都在 moveCodex.js 里，图鉴不再自己维护白名单——
// 此前这儿有张 SKILL_GROUP_LABEL 只列了玉泉/雪山/锦官，而筛选写的是
// `.filter(([k]) => SKILL_GROUP_LABEL[k])`，把它当成了白名单：
// 独孤/青城/峨眉/唐门/血刀/三星 六家共 39 门连同全部专属招/制式招/博弈招，
// 一共两百多招在图鉴里一个都看不到，而且丢得毫无痕迹。
const SRC_TABS = [MOVE_SOURCE.WUGUAN, MOVE_SOURCE.SIGNATURE, MOVE_SOURCE.STANDARD, MOVE_SOURCE.BURDEN];

export default function CodexScreen({ zoneTheme, isDayMode = false, inv = [], skills = [], onClose }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  // ESC 关闭：玩家把字号调大之后，图鉴内容会顶出屏幕高度，右上角那个叉点不到，
  // 除了刷新页面没有别的退路。键盘退路必须有。
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const [tab, setTab] = useState("item"); // item | skill
  const [srcTab, setSrcTab] = useState(MOVE_SOURCE.WUGUAN);
  const [catFilter, setCatFilter] = useState("all");
  const [qFilter, setQFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false); // 只看已获得

  // 三期·收集进度：玩家已拥有的物品名 / 已学武功名，做成 Set 供比对
  const ownedItems = useMemo(() => new Set(inv.map(i => (typeof i === "string" ? i : i.name))), [inv]);
  const ownedSkills = useMemo(() => new Set(skills.map(s => s.name)), [skills]);

  const kw = search.trim();

  // 物品筛选（读全量 CATALOG）+ 搜索 + 只看已获得
  const items = useMemo(() => {
    return CATALOG.filter(it =>
      (catFilter === "all" || it.category === catFilter) &&
      (qFilter === "全部" || it.quality === qFilter) &&
      (!kw || it.name.includes(kw) || (it.desc || "").includes(kw)) &&
      (!ownedOnly || ownedItems.has(it.name))
    );
  }, [catFilter, qFilter, kw, ownedOnly, ownedItems]);

  // 武学：走 moveCodex 的归一总录（武馆+专属+制式+博弈四源合一），按来源分页
  const codexStats = useMemo(() => moveCodexStats(), []);
  const skillGroups = useMemo(() => {
    const list = (moveCodexBySource()[srcTab] || []).filter(mv =>
      (!kw || mv.name.includes(kw) || (mv.desc || "").includes(kw) || (mv.owner || "").includes(kw)) &&
      (!ownedOnly || ownedSkills.has(mv.name))
    );
    return groupMoves(list).filter(([, l]) => l.length > 0);
  }, [kw, ownedOnly, ownedSkills, srcTab]);

  // 收集进度统计
  const itemOwnedCount = useMemo(() => CATALOG.filter(it => ownedItems.has(it.name)).length, [ownedItems]);

  const T = zoneTheme;
  const paperText = isDayMode ? "#3a2a14" : "#3a2a14"; // 卷轴纸永远是深色底纹，字用深棕
  const paperDim = "#8a6a3a";
  const paperAccent = "#6a3a10";

  const chipStyle = (on) => ({
    cursor: "pointer", padding: "3px 12px", fontSize: "12px", userSelect: "none",
    backgroundImage: `url(${S("ui/bar_paper.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
    color: on ? "#5a2d08" : "#9a7a4a", fontWeight: on ? "bold" : "normal", opacity: on ? 1 : 0.6,
  });
  const tabStyle = (on) => ({
    cursor: "pointer", padding: "7px 26px", fontSize: "15px", border: "none",
    backgroundImage: `url(${S("ui/bar_wood.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
    color: on ? "#f0e0b0" : "#c8a86a", textShadow: on ? "0 1px 2px #000" : "none", opacity: on ? 1 : 0.55,
  });

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(10,8,4,0.9)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onMouseDown={closeGuard.onMouseDown}
      onClick={closeGuard.onClick}
    >
      <div
        style={{
          position: "relative", width: 760, maxWidth: "96vw", height: "88vh",
          backgroundImage: `url(${S("ui/panel_big.webp")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
          padding: "42px 46px 40px", display: "flex", flexDirection: "column",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 关闭 */}
        <span onClick={onClose} title="合上（也可按 ESC）"
          style={{ position: "absolute", top: 30, right: 34, cursor: "pointer", fontSize: 18, color: paperAccent, zIndex: 2 }}>✕</span>

        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 22, color: paperAccent, fontWeight: "bold", letterSpacing: 3 }}>百物 · 武学总览</div>
          <div style={{ fontSize: 11, color: paperDim, margin: "3px 0 14px" }}>此卷录尽曲措乡叫得出名号的物件与武学</div>
        </div>

        {/* 两大页签 */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 12, flexShrink: 0 }}>
          <button style={tabStyle(tab === "item")} onClick={() => setTab("item")}>物 品</button>
          <button style={tabStyle(tab === "skill")} onClick={() => setTab("skill")}>武 学</button>
        </div>

        {/* 搜索 + 只看已获得（两页签共用） */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexShrink: 0, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜名字或介绍…"
            style={{
              flex: 1, minWidth: 140, padding: "5px 10px", fontSize: 12, fontFamily: "inherit",
              background: "rgba(255,250,235,0.6)", border: "1px solid #b3987a", borderRadius: 4, color: "#3a2a14",
            }}
          />
          {search && <span onClick={() => setSearch("")} style={{ cursor: "pointer", color: paperDim, fontSize: 12 }}>✕清空</span>}
          <span onClick={() => setOwnedOnly(o => !o)} style={chipStyle(ownedOnly)} title="只显示已获得的">
            {ownedOnly ? "✓ 只看已得" : "只看已得"}
          </span>
        </div>

        {/* 物品筛选 */}
        {tab === "item" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 10, padding: "7px 10px", background: "rgba(120,90,50,0.08)", borderRadius: 6, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ color: paperDim, fontSize: 11 }}>类别</span>
              {CAT_FILTERS.map(c => <span key={c.key} style={chipStyle(catFilter === c.key)} onClick={() => setCatFilter(c.key)}>{c.label}</span>)}
            </div>
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ color: paperDim, fontSize: 11 }}>品阶</span>
              {Q_FILTERS.map(q => <span key={q} style={chipStyle(qFilter === q)} onClick={() => setQFilter(q)}>{q}</span>)}
            </div>
          </div>
        )}

        {/* 滚动内容区 */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 6 }}>
          {tab === "item" ? (
            <>
              <div style={{ fontSize: 11, color: paperDim, marginBottom: 6, paddingLeft: 4 }}>
                共 {items.length} 件 · 已收录 <span style={{ color: paperAccent }}>{itemOwnedCount}/{CATALOG.length}</span>
              </div>
              {items.map((it, i) => <ItemRow key={it.name + i} it={it} owned={ownedItems.has(it.name)} paperText={paperText} paperDim={paperDim} paperAccent={paperAccent} />)}
              {items.length === 0 && <div style={{ color: paperDim, textAlign: "center", padding: 30 }}>{ownedOnly ? "尚无已获得的物件" : "此类暂无记载"}</div>}
            </>
          ) : (
            <>
              {/* 来源分页：武馆 / 专属 / 制式 / 博弈 —— 四源合计两百多招 */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                {SRC_TABS.map(src => (
                  <button key={src} onClick={() => setSrcTab(src)}
                    style={{
                      fontSize: 12, padding: "3px 10px", borderRadius: 3, cursor: "pointer",
                      border: `1px solid ${srcTab === src ? "#a0651a" : "rgba(120,90,50,0.35)"}`,
                      background: srcTab === src ? "rgba(160,101,26,0.18)" : "transparent",
                      color: srcTab === src ? paperAccent : paperDim, fontFamily: "inherit",
                    }}>
                    {src}·{codexStats.bySource[src] || 0}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: paperDim, marginBottom: 6, paddingLeft: 4 }}>
                全图共 <span style={{ color: paperAccent }}>{codexStats.total}</span> 招 · 本页 {skillGroups.reduce((n, [, l]) => n + l.length, 0)} 招
              </div>
              {skillGroups.map(([grp, list]) => (
                <div key={grp}>
                  <div style={{ fontSize: 15, color: paperAccent, margin: "16px 0 6px", letterSpacing: 1, fontWeight: "bold", borderLeft: "4px solid #a0651a", paddingLeft: 10 }}>{grp}</div>
                  {list.map((sk, i) => <SkillRow key={sk.id || i} sk={sk} owned={ownedSkills.has(sk.name)} paperText={paperText} paperDim={paperDim} paperAccent={paperAccent} />)}
                </div>
              ))}
              {skillGroups.length === 0 && <div style={{ color: paperDim, textAlign: "center", padding: 30 }}>{ownedOnly ? "尚未习得任何武学" : "无匹配武学"}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// 物品条目行
function ItemRow({ it, owned, paperText, paperDim, paperAccent }) {
  const qc = QUALITY_COLOR[it.quality] || "#8a8578";
  const jade = jadeSrc(it.quality);
  // 数值：武器给攻倍率、护甲给防倍率、有六维给六维
  const statBits = [];
  if (it.atkMul) statBits.push(`攻·倍率${it.atkMul}`);
  if (it.defMul) statBits.push(`防·倍率${it.defMul}`);
  if (it.sixDim) statBits.push(Object.entries(it.sixDim).map(([k, v]) => `${k}+${v}`).join(" "));
  const effectName = it.effect && typeof it.effect === "object"
    ? (Object.values(it.effect).find(v => v && v.name)?.name || "特效")
    : null;
  const dist = itemDistText(it.name);
  return (
    <div style={{ display: "flex", gap: 12, padding: "11px 8px", alignItems: "center", borderBottom: "1px solid rgba(120,90,50,0.22)", opacity: owned ? 1 : 0.92 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        {jade && <img src={jade} alt={it.quality} style={{ width: 42, height: 42, objectFit: "contain", filter: owned ? "drop-shadow(0 2px 3px rgba(0,0,0,0.3))" : "grayscale(0.55) opacity(0.7)" }} />}
        {owned && <span style={{ position: "absolute", right: -3, bottom: -2, fontSize: 13, color: "#3a9a3a", textShadow: "0 0 2px #fff" }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: "bold", color: qc }}>{it.name}</span>
          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 8, color: "#fff", background: qc }}>{it.quality}</span>
          <span style={{ fontSize: 10, color: paperDim }}>{CATEGORY_LABEL[it.category] || it.category}</span>
          {statBits.length > 0 && <span style={{ fontSize: 11, color: "#a05a10" }}>{statBits.join(" · ")}</span>}
          {effectName && <span style={{ fontSize: 11, color: "#a05a10" }}>· {effectName}</span>}
          {owned && <span style={{ fontSize: 10, color: "#3a9a3a" }}>· 已获得</span>}
        </div>
        {it.desc && <div style={{ color: "#6a5230", fontSize: 12, marginTop: 3, lineHeight: 1.7 }}>{it.desc}</div>}
        <div style={{ fontSize: 11, marginTop: 4, color: dist.kind === "special" ? "#9a6a2a" : "#5a3a12" }}>
          📍 <span style={{ color: dist.kind === "special" ? "#9a6a2a" : "#9a5a10" }}>{dist.text}</span>
        </div>
      </div>
    </div>
  );
}

// 武学条目行
function SkillRow({ sk, owned, paperText, paperDim, paperAccent }) {
  const qc = QUALITY_COLOR[sk.quality] || "#8a8578";
  const jade = jadeSrc(sk.quality);
  const bonusBits = [];
  if (sk.owner) bonusBits.push(`${sk.owner}·${sk.slot || ""}`);
  if (sk.skillType) bonusBits.push(sk.skillType + (sk.type ? `·${sk.type}` : ""));
  else if (sk.type) bonusBits.push(`招式·${sk.type}`);
  if (sk.unlearnable) bonusBits.push("不可学");
  // 被动加成与招式特效都走 itemEffectText 那份唯一词典，图鉴不再自己拼一遍
  const pb = passiveBonusBrief(sk.passiveBonus);
  if (pb) bonusBits.push(pb);
  const fx = moveEffectBrief(sk);
  if (fx) bonusBits.push(fx);
  return (
    <div style={{ display: "flex", gap: 12, padding: "11px 8px", alignItems: "center", borderBottom: "1px solid rgba(120,90,50,0.22)", opacity: owned ? 1 : 0.92 }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        {jade && <img src={jade} alt={sk.quality} style={{ width: 42, height: 42, objectFit: "contain", filter: owned ? "drop-shadow(0 2px 3px rgba(0,0,0,0.3))" : "grayscale(0.55) opacity(0.7)" }} />}
        {owned && <span style={{ position: "absolute", right: -3, bottom: -2, fontSize: 13, color: "#3a9a3a", textShadow: "0 0 2px #fff" }}>✓</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: "bold", color: qc }}>{sk.name}</span>
          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 8, color: "#fff", background: qc }}>{sk.quality}</span>
          <span style={{ fontSize: 10, color: paperDim }}>{sk.type}</span>
          {typeof sk.price === "number" && (
            <span style={{ fontSize: 11, color: "#a05a10" }}>
              <img src={S("ui/ingot.webp")} alt="" style={{ width: 13, verticalAlign: -2, marginRight: 2 }} />{sk.price} 两
            </span>
          )}
          {owned && <span style={{ fontSize: 10, color: "#3a9a3a" }}>· 已习得</span>}
        </div>
        {bonusBits.length > 0 && (
          <div style={{ fontSize: 11, marginTop: 3, color: "#5a3a12" }}>✦ 效果：<span style={{ color: "#9a5a10" }}>{bonusBits.join(" · ")}</span></div>
        )}
        {sk.desc && <div style={{ color: "#6a5230", fontSize: 12, marginTop: 3, lineHeight: 1.7 }}>{sk.desc}</div>}
      </div>
    </div>
  );
}
