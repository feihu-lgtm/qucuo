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

import React, { useState, useMemo } from "react";
import { CATALOG } from "./items/catalog.js";
import { CATEGORY_LABEL, QUALITY, QUALITY_COLOR } from "./equipment.js";
import { SKILL_CATALOG } from "./kungfu/qucuoKungfu.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
const S = (f) => `${BASE}stones/${f}`;

// 品阶 → 玉石图代号（对应 public/stones/jade_N_色_chun.png）
const JADE_CODE = { 白: ["1", "bai"], 绿: ["2", "lv"], 蓝: ["3", "lan"], 紫: ["4", "zi"], 橙: ["5", "cheng"], 红: ["6", "hong"] };
const jadeSrc = (q) => { const c = JADE_CODE[q]; return c ? S(`jade_${c[0]}_${c[1]}_chun.png`) : null; };

// 物品类别筛选项：全部 + 四大类 + 两个特殊层（传说/神兵按 tags/标记区分）
const CAT_FILTERS = [
  { key: "all", label: "全部" },
  { key: "weapon", label: "武器" },
  { key: "armor", label: "护甲" },
  { key: "accessory", label: "饰品" },
  { key: "misc", label: "杂物" },
];
const Q_FILTERS = ["全部", ...QUALITY];

// 武学分组的展示名（SKILL_CATALOG 的 key 是武馆位置代号）
const SKILL_GROUP_LABEL = { 玉泉: "玉泉练武场", 雪山: "雪山派", 锦官: "锦官城武馆" };

export default function CodexScreen({ zoneTheme, isDayMode = false, onClose }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const [tab, setTab] = useState("item"); // item | skill
  const [catFilter, setCatFilter] = useState("all");
  const [qFilter, setQFilter] = useState("全部");

  // 物品筛选（读全量 CATALOG）
  const items = useMemo(() => {
    return CATALOG.filter(it =>
      (catFilter === "all" || it.category === catFilter) &&
      (qFilter === "全部" || it.quality === qFilter)
    );
  }, [catFilter, qFilter]);

  // 武学：SKILL_CATALOG 只取"武馆分组"（玉泉/雪山/锦官），过滤掉突破价目表那些非数组/非武馆 key
  const skillGroups = useMemo(() => {
    return Object.entries(SKILL_CATALOG)
      .filter(([k, v]) => Array.isArray(v) && SKILL_GROUP_LABEL[k])
      .map(([k, v]) => [SKILL_GROUP_LABEL[k], v]);
  }, []);

  const T = zoneTheme;
  const paperText = isDayMode ? "#3a2a14" : "#3a2a14"; // 卷轴纸永远是深色底纹，字用深棕
  const paperDim = "#8a6a3a";
  const paperAccent = "#6a3a10";

  const chipStyle = (on) => ({
    cursor: "pointer", padding: "3px 12px", fontSize: "12px", userSelect: "none",
    backgroundImage: `url(${S("ui/bar_paper.png")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
    color: on ? "#5a2d08" : "#9a7a4a", fontWeight: on ? "bold" : "normal", opacity: on ? 1 : 0.6,
  });
  const tabStyle = (on) => ({
    cursor: "pointer", padding: "7px 26px", fontSize: "15px", border: "none",
    backgroundImage: `url(${S("ui/bar_wood.png")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
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
          backgroundImage: `url(${S("ui/panel_big.png")})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
          padding: "42px 46px 40px", display: "flex", flexDirection: "column",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 关闭 */}
        <span onClick={onClose} title="合上"
          style={{ position: "absolute", top: 30, right: 34, cursor: "pointer", fontSize: 18, color: paperAccent, zIndex: 2 }}>✕</span>

        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 22, color: paperAccent, fontWeight: "bold", letterSpacing: 3 }}>百物 · 武学总览</div>
          <div style={{ fontSize: 11, color: paperDim, margin: "3px 0 14px" }}>此卷录尽曲措乡叫得出名号的物件与武学</div>
        </div>

        {/* 两大页签 */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 14, flexShrink: 0 }}>
          <button style={tabStyle(tab === "item")} onClick={() => setTab("item")}>物 品</button>
          <button style={tabStyle(tab === "skill")} onClick={() => setTab("skill")}>武 学</button>
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
              <div style={{ fontSize: 11, color: paperDim, marginBottom: 6, paddingLeft: 4 }}>共 {items.length} 件</div>
              {items.map((it, i) => <ItemRow key={it.name + i} it={it} paperText={paperText} paperDim={paperDim} paperAccent={paperAccent} />)}
              {items.length === 0 && <div style={{ color: paperDim, textAlign: "center", padding: 30 }}>此类暂无记载</div>}
            </>
          ) : (
            skillGroups.map(([grp, list]) => (
              <div key={grp}>
                <div style={{ fontSize: 15, color: paperAccent, margin: "16px 0 6px", letterSpacing: 1, fontWeight: "bold", borderLeft: "4px solid #a0651a", paddingLeft: 10 }}>{grp}</div>
                {list.map((sk, i) => <SkillRow key={sk.id || i} sk={sk} paperText={paperText} paperDim={paperDim} paperAccent={paperAccent} />)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// 物品条目行
function ItemRow({ it, paperText, paperDim, paperAccent }) {
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
  return (
    <div style={{ display: "flex", gap: 12, padding: "11px 8px", alignItems: "center", borderBottom: "1px solid rgba(120,90,50,0.22)" }}>
      {jade && <img src={jade} alt={it.quality} style={{ width: 42, height: 42, flexShrink: 0, objectFit: "contain", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))" }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: "bold", color: qc }}>{it.name}</span>
          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 8, color: "#fff", background: qc }}>{it.quality}</span>
          <span style={{ fontSize: 10, color: paperDim }}>{CATEGORY_LABEL[it.category] || it.category}</span>
          {statBits.length > 0 && <span style={{ fontSize: 11, color: "#a05a10" }}>{statBits.join(" · ")}</span>}
          {effectName && <span style={{ fontSize: 11, color: "#a05a10" }}>· {effectName}</span>}
        </div>
        {it.desc && <div style={{ color: "#6a5230", fontSize: 12, marginTop: 3, lineHeight: 1.7 }}>{it.desc}</div>}
      </div>
    </div>
  );
}

// 武学条目行
function SkillRow({ sk, paperText, paperDim, paperAccent }) {
  const qc = QUALITY_COLOR[sk.quality] || "#8a8578";
  const jade = jadeSrc(sk.quality);
  const bonusBits = [];
  if (sk.moveType) bonusBits.push(`招式·${sk.moveType}`);
  if (sk.passiveBonus) {
    if (sk.passiveBonus.maxHp) bonusBits.push(`气血上限+${sk.passiveBonus.maxHp}`);
    if (sk.passiveBonus.speedBonus) bonusBits.push(`身法+${sk.passiveBonus.speedBonus}`);
  }
  return (
    <div style={{ display: "flex", gap: 12, padding: "11px 8px", alignItems: "center", borderBottom: "1px solid rgba(120,90,50,0.22)" }}>
      {jade && <img src={jade} alt={sk.quality} style={{ width: 42, height: 42, flexShrink: 0, objectFit: "contain", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.3))" }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16, fontWeight: "bold", color: qc }}>{sk.name}</span>
          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 8, color: "#fff", background: qc }}>{sk.quality}</span>
          <span style={{ fontSize: 10, color: paperDim }}>{sk.type}</span>
          {typeof sk.price === "number" && (
            <span style={{ fontSize: 11, color: "#a05a10" }}>
              <img src={S("ui/ingot.png")} alt="" style={{ width: 13, verticalAlign: -2, marginRight: 2 }} />{sk.price} 两
            </span>
          )}
        </div>
        {bonusBits.length > 0 && (
          <div style={{ fontSize: 11, marginTop: 3, color: "#5a3a12" }}>✦ 效果：<span style={{ color: "#9a5a10" }}>{bonusBits.join(" · ")}</span></div>
        )}
        {sk.desc && <div style={{ color: "#6a5230", fontSize: 12, marginTop: 3, lineHeight: 1.7 }}>{sk.desc}</div>}
      </div>
    </div>
  );
}
