// 斗蛐蛐共享件：素材路径、品阶映射、QB_CSS、sx 样式表。
// 从 QuickBattleScreen.jsx 拆出（纯搬运）。高频硬编码色收敛为 tokens.css
// 的 --qb-* 语义变量（值原样，见 tokens.css 斗蛐蛐一节）。

import { QUALITY } from "../../../domain/rules/economy/equipment.js";
import { npcArtUrl } from "../../art/art.js";
import { resolveCardPortrait } from "../../../domain/rules/companion/portraits.js";
import { QUALITY_COLOR } from "../../../domain/data/items/qualityColor.js";

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
export const S = (f) => `${BASE}stones/${f}`;
export const UI = (f) => `${BASE}stones/ui/${f}`;
// 【为什么不能直接拼】这个函数原本只服务内置八人（public/bidders/full/ 下是
// 才旦.webp、兰姐.webp 这类中文名文件），portrait 字段存的就是中文名。但入册角色
// 的 portrait 可能是内置十张的键名、也可能是一整条 dataURL（玩家上传或从卡里取
// 的图），直接拼会拼出 bidders/full/data:image...webp 这种东西。
// 顺序：自备图直接用 → 内置立绘查表 → 都不是才当作 bidders/full 下的文件名。
export const PORTRAIT = (v) => {
  if (!v) return "";
  const resolved = resolveCardPortrait(v);
  if (resolved) return resolved;
  return `${BASE}bidders/full/${v}.webp`;
};

// 立绘统一查图：优先 artManifest 登记的 npc/<name>.webp（302 张全库），
// 落空再退 bidders/full 老八张，都没有返回 null 由调用方用品阶色占位。
export const fighterArtUrl = (name, portrait) => npcArtUrl(name) || (portrait ? PORTRAIT(portrait) : null);

// 品阶→档位色（复用装备那套 QUALITY_COLOR）；levelCap 0-5 直接映射 QUALITY 索引
export const tierColor = (levelCap) => QUALITY_COLOR[QUALITY[Math.max(0, Math.min(5, levelCap))]] || "var(--ink-text)";
export const tierName = (levelCap) => QUALITY[Math.max(0, Math.min(5, levelCap))] || "白";
export const MAX_TEAM = 6; // 每队最多 6 人（宝可梦味）

export const QB_CSS = `
  .qb-flip{ position:relative; width:100%; height:100%; }
  .qb-face{ position:absolute; inset:0; display:flex; flex-direction:column; border-radius:5px; overflow:hidden; animation:qbFaceIn .16s ease both; }
  @keyframes qbFaceIn{from{opacity:0;transform:scaleX(.96)}to{opacity:1;transform:scaleX(1)}}
  /* 伤害数字弹跳：结算后在对峙区飘一下 */
  .qb-dmg{ animation:qbDmg .9s ease-out forwards; }
  @keyframes qbDmg{
    0%{ opacity:0; transform:translateY(6px) scale(.7); }
    18%{ opacity:1; transform:translateY(-4px) scale(1.15); }
    40%{ transform:translateY(-8px) scale(1); }
    100%{ opacity:0; transform:translateY(-26px) scale(.95); }
  }
  /* ── 窄屏(手机)紧凑化：对峙区/选人/技能卡收窄，避免挤爆 ── */
  @media (max-width: 640px){
    /* 对峙区改上下堆叠：我方在上、敌方在下，两人血条都能完整显示 */
    .qb-arena{ flex-direction:column !important; gap:8px !important; padding:8px 10px !important; }
    .qb-arena .qb-fighter{ width:100% !important; align-items:stretch !important; }
    .qb-arena .qb-fighter-info{ min-width:0 !important; flex:1 !important; text-align:left !important; }
    .qb-arena .qb-vs{ padding-top:0 !important; flex-direction:row !important; }
    .qb-arena .qb-vs img{ width:28px !important; }
    .qb-arena .qb-portrait{ width:48px !important; height:64px !important; }
    .qb-cardrow{ gap:6px !important; }
    .qb-card{ width:calc(50% - 3px) !important; height:132px !important; }
    .qb-candgrid{ grid-template-columns:repeat(auto-fill,minmax(84px,1fr)) !important; gap:8px !important; }
    .qb-face.qb-back{ font-size:11px !important; }
  }
  @media (max-width: 767px){
    .qb-candgrid{
      grid-template-columns:repeat(2,minmax(0,1fr)) !important;
      gap:8px !important;
    }
    .qb-candgrid .qb-candidate-card{ min-height:44px !important; }
    .qb-battle-screen{
      overflow-x:hidden !important;
      overflow-y:auto !important;
      -webkit-overflow-scrolling:touch;
    }
  }
  @media (max-width: 767px) and (max-height: 450px){
    .qb-candgrid .qb-candidate-card{
      aspect-ratio:auto !important;
      height:clamp(96px,32dvh,132px) !important;
    }
  }
  .qb-candgrid{ grid-auto-rows:max-content !important; }
`;

export const sx = {
  root: { position: "fixed", inset: 0, fontFamily: "var(--font-body)", overflow: "hidden", color: "var(--qb-text)" },
  bg: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
  scrim: { position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,6,4,.72) 0%, rgba(8,6,4,.55) 40%, rgba(8,6,4,.8) 100%)" },
  centerCol: { position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: 24, boxSizing: "border-box", textAlign: "center" },
  title: { fontSize: "var(--fs-3xl)", letterSpacing: 16, color: "var(--gold-light)", margin: 0, textShadow: "0 3px 12px rgba(0,0,0,.7)" },
  subtitle: { fontSize: "var(--fs-base)", letterSpacing: 3, color: "var(--parchment)", marginTop: 12 },

  pickWrap: { position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column",
    padding: "16px clamp(16px,4vw,60px)", boxSizing: "border-box" },
  pickHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  startBtn: { padding: "9px 18px", background: "linear-gradient(180deg,var(--qb-start-top),var(--qb-start-bottom))", border: "1px solid var(--parchment)",
    borderRadius: 0, color: "var(--qb-start-text)", fontSize: "var(--fs-base)", letterSpacing: 1, cursor: "pointer", fontWeight: "bold" },
  teamsRow: { display: "flex", alignItems: "stretch", gap: 12, marginBottom: 10 },
  vs: { display: "flex", alignItems: "center", fontSize: "var(--fs-xl)", color: "var(--qb-versus)", fontWeight: "bold" },
  pickHint: { fontSize: "var(--fs-sm)", color: "var(--qb-pick-hint)", marginBottom: 12, lineHeight: 1.6 },
  candidateGrid: { flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(108px,1fr))",
    gap: 12, overflowY: "auto", alignContent: "start", paddingBottom: 12,
    borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 14 },
  candidateGridInner: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(108px,1fr))",
    gap: 12, alignContent: "start" },
  pickListScroll: { flex: 1, overflowY: "auto", borderTop: "1px solid rgba(255,255,255,.1)", paddingTop: 10 },
  pickGroupWrap: { marginBottom: 14 },
  pickGroupLabel: (isOc) => ({ fontSize: "var(--fs-xs)", letterSpacing: 3, color: isOc ? "var(--gold-light)" : "var(--qb-border)", margin: "4px 0 8px" }),
  lastMoveTag: (color) => ({ marginTop: 3, fontSize: "var(--fs-xs)", fontWeight: "bold", letterSpacing: 1,
    color, textShadow: "0 1px 3px var(--black)" }),

  battleWrap: { position: "relative", zIndex: 1, height: "100%", display: "flex", flexDirection: "column",
    padding: "14px clamp(16px,4vw,50px)", boxSizing: "border-box" },
  battleTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 6 },
  arena: { display: "flex", alignItems: "flex-start", gap: 16, padding: "14px 16px", marginBottom: 12,
    background: "rgba(15,12,8,.5)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 0 },
  arenaVs: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, paddingTop: 20 },
  logStream: { flex: 1, overflowY: "auto", padding: "12px 16px", background: "rgba(10,8,5,.6)",
    border: "1px solid rgba(255,255,255,.08)", borderRadius: 0, marginBottom: 12, minHeight: 80 },
  controlBar: { display: "flex", gap: 10, padding: "12px 14px", background: "rgba(20,16,10,.7)",
    border: "1px solid rgba(255,255,255,.12)", borderRadius: 0, minHeight: 116, alignItems: "flex-start" },
  switchBtn: { padding: "8px 16px", background: "rgba(40,60,80,.6)", border: "1px solid var(--blue)",
    borderRadius: 0, color: "var(--qb-switch-text)", fontSize: "var(--fs-md)", cursor: "pointer" },
  switchBtnSmall: { padding: "4px 10px", background: "rgba(40,60,80,.5)", border: "1px solid var(--qb-switch-edge)",
    borderRadius: 0, color: "var(--qb-switch-text)", fontSize: "var(--fs-xs)", cursor: "pointer", whiteSpace: "nowrap" },
  dmgTag: (c) => ({ padding: "1px 7px", borderRadius: 0, background: `color-mix(in srgb, ${c} 13%, transparent)`, border: `1px solid ${c}`,
    color: c, fontWeight: "bold", fontSize: "var(--fs-xs)" }),
};
