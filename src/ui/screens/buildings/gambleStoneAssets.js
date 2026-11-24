// 赌石屏的纯常量：素材路径、立绘表、切刀位置、动画 CSS、按钮样式。
// 从 GambleStoneScreen.jsx 拆出，供主屏与 GambleStoneParts.jsx 共用。
import { CHANG_KOU } from "../../../domain/rules/economy/gambleStone.js";

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
export const S = (f) => `${BASE}stones/${f}`;
export const UI = (f) => `${BASE}stones/ui/${f}`;
export const FRAME = `${BASE}stones/frames/frame_lux.webp`;
// 竞价者名 → 无框写实立绘（public/bidders/full/，941×1672，与 frame_lux 同尺寸分层合成）
const PORTRAIT_BY_NAME = {
  "李若由": "李若由", "锦官差役": "锦官差役", "雪山弟子": "雪山门人",
  "黑风寨采买": "黑风寨采买", "才旦": "才旦", "苏宛": "苏宛",
  "兰姐": "兰姐", "温掌柜": "温掌柜",
};
export const P = (name) => `${BASE}bidders/full/${PORTRAIT_BY_NAME[name] || "温掌柜"}.webp`;

// frame_lux 内窗实测 bbox（x[187,752] y[290,1454] / 941×1672）——立绘 clip 进窗、框叠其上
export const WIN = { x: "19.9%", y: "17.3%", w: "60.2%", h: "69.7%" };

// 卡面身份小注（背面信息面用，与 BIDDER_TYPES.bio 相补）
export const ROLE_BY_NAME = {
  "李若由": "玉泉小栈经营者 · 现银", "锦官差役": "官差 · 只收武器胚",
  "雪山弟子": "雪山派后生 · 以物易物", "黑风寨采买": "黑风寨外柜 · 人情债",
  "才旦": "鱼定村长之女 · 现银", "苏宛": "苏记茶货铺 · 现银",
  "兰姐": "百花门主 · 附带条件", "温掌柜": "料场庄家 · 回收兜底",
};

export const SLOT_LABEL = { top: "上刀", mid: "中刀", bot: "下刀" };
export const CHANG_KOU_KEYS = Object.keys(CHANG_KOU);

// 三刀口在石头上的固定位置 + 露肉图的局部偏移（全部百分比，随石头尺寸缩放）
export const CUT_POS = {
  top: { top: "18%", left: "40%", jt: "-27%", jl: "-42%" },
  mid: { top: "42%", left: "50%", jt: "-54%", jl: "-77%" },
  bot: { top: "62%", left: "42%", jt: "-85%", jl: "-50%" },
};

// hover 翻面/放大的 CSS（组件内注入）。两条血泪（预览页实证）：
// ① drop-shadow 的 filter 放在带 preserve-3d 的元素上会强制 flat 化、背面永远出不来——阴影只能挂外壳 .gs-tilt；
// ② 父层 scale 过渡 + 子层 rotateY 过渡分开跑会被合成器卡在中途——放大与翻转必须合并在 .gs-flip 同一个 transform 里过渡。
export const GS_CSS = `
  .gs-seat:hover{ z-index:200 !important; }
  .gs-tilt{ transform-origin:50% 80%; filter:drop-shadow(0 8px 16px rgba(0,0,0,.65)); }
  .gs-flip{ position:relative; width:100%; aspect-ratio:941/1672; transform-origin:50% 80%;
    transform-style:preserve-3d; transition:transform .55s cubic-bezier(.4,0,.2,1); }
  .gs-seat:hover .gs-flip{ transform:scale(1.42) translateY(-5%) rotateY(180deg); }
  .gs-face{ position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden;
    transform:rotateY(0deg); }
  .gs-face.gs-back{ transform:rotateY(180deg); }

  /* ── 开刀动画（交接文档§五：刀光→碎末→屏息→开口→露肉→裂→揭晓）一套约1.4s ── */
  .gs-shake{ animation:gsShake .42s ease-in-out; }
  @keyframes gsShake{
    0%,100%{ transform:translateX(-50%); }
    18%{ transform:translateX(calc(-50% - 7px)) rotate(-1.2deg); }
    38%{ transform:translateX(calc(-50% + 6px)) rotate(1deg); }
    58%{ transform:translateX(calc(-50% - 4px)); }
    80%{ transform:translateX(calc(-50% + 2px)); }
  }
  .gs-slash{ animation:gsSlash .38s ease-out forwards; opacity:0; pointer-events:none; }
  @keyframes gsSlash{
    0%{ opacity:0; transform:translate(-70%,-20%) var(--slash-rot) scaleX(.5); }
    30%{ opacity:1; }
    100%{ opacity:0; transform:translate(30%,10%) var(--slash-rot) scaleX(1.15); }
  }
  .gs-dust{ animation:gsDust .6s ease-out .18s forwards; opacity:0; pointer-events:none; }
  @keyframes gsDust{
    0%{ opacity:0; transform:scale(.35); }
    25%{ opacity:.95; }
    100%{ opacity:0; transform:scale(1.7) translateY(-14%); }
  }
  .gs-shard{ position:absolute; width:5%; height:5%; border-radius:30%; opacity:0;
    animation:gsShard .58s cubic-bezier(.2,.7,.4,1) .2s forwards; pointer-events:none; }
  @keyframes gsShard{
    0%{ opacity:1; transform:translate(0,0) scale(1); }
    100%{ opacity:0; transform:translate(var(--dx),var(--dy)) scale(.4); }
  }
  .gs-open{ animation:gsOpen .5s cubic-bezier(.34,1.5,.64,1) .62s both; }
  @keyframes gsOpen{
    0%{ transform:scale(0); }
    70%{ transform:scale(1.12); }
    100%{ transform:scale(1); }
  }
  .gs-reveal{ animation:gsReveal .55s ease-out .8s both; }
  @keyframes gsReveal{
    0%{ opacity:0; filter:brightness(2.6) saturate(.4); }
    45%{ opacity:1; filter:brightness(1.7); }
    100%{ opacity:1; filter:brightness(1); }
  }
  .gs-crackfx{ animation:gsCrackG .45s ease-out 1.02s both; }
  @keyframes gsCrackG{
    0%{ opacity:0; transform:scale(.55); }
    100%{ opacity:1; transform:scale(1); }
  }
  .gs-label{ animation:gsLabel 1.05s cubic-bezier(.2,.8,.3,1) .88s both; pointer-events:none; }
  @keyframes gsLabel{
    0%{ opacity:0; transform:translate(-50%,30%) scale(.5); }
    22%{ opacity:1; transform:translate(-50%,-10%) scale(1.18); }
    60%{ opacity:1; transform:translate(-50%,-40%) scale(1); }
    100%{ opacity:0; transform:translate(-50%,-85%) scale(1.05); }
  }
`;

// 碎末粒子的飞散向量（固定伪随机，避免每次渲染变位）
export const SHARDS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + (i % 3) * 0.4;
  const r = 55 + (i * 37) % 60;
  return { dx: `${Math.round(Math.cos(a) * r)}%`, dy: `${Math.round(Math.sin(a) * r * 0.8 - 30)}%` };
});
// 品相 → 碎末颜色（纯青绿 / 白米灰 / 杂褐）
export const SHARD_COLOR = { chun: "var(--gamble-jade)", bai: "var(--qb-text)", za: "var(--gamble-za)" };
// 揭晓大字（outcome → 字/色）
export const OUTCOME_LABEL = { 涨: ["涨", "var(--gamble-jade)"], 平: ["平", "var(--qb-text)"], 垮: ["垮", "var(--gamble-loss)"], 裂: ["裂!", "var(--qb-damage)"] };
// 刀口方位 → 刀光角度
export const SLASH_ROT = { top: "rotate(-24deg)", mid: "rotate(4deg)", bot: "rotate(21deg)" };

export const topBtn = { background: "none", border: "1px solid var(--gamble-button-edge)", color: "var(--gamble-button-text)", borderRadius: 0, padding: "4px 12px", cursor: "pointer", fontSize: "var(--fs-sm)" };
export const carArrow = { flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: "1px solid var(--ink-brass)",
  background: "rgba(20,16,11,.9)", color: "var(--gold-light)", fontSize: 22, lineHeight: 1, cursor: "pointer", userSelect: "none" };
export const carBtn = { width: "100%", padding: "10px 0", border: "none", borderRadius: 0, fontSize: 14, fontWeight: "bold", cursor: "pointer" };
export const actBtn = { position: "relative", height: "6.4vh", minWidth: "24vh", border: "none", cursor: "pointer",
  background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "1.9vh", fontWeight: "bold", fontFamily: "inherit", letterSpacing: 2,
  backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", transition: "transform .15s, filter .15s" };
