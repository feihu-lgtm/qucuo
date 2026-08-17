import React, { useState, useMemo, useEffect } from "react";
import {
  CHANG_KOU, SKINS, JADE_TIERS, GRADE,
  birthStone, cutSlot, appraiseStone,
  rollBidders, rollCommission, readSkinClue,
} from "../gambleStone.js";

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
const S = (f) => `${BASE}stones/${f}`;
const UI = (f) => `${BASE}stones/ui/${f}`;
const FRAME = `${BASE}stones/frames/frame_lux.webp`;
// 竞价者名 → 无框写实立绘（public/bidders/full/，941×1672，与 frame_lux 同尺寸分层合成）
const PORTRAIT_BY_NAME = {
  "李若由": "李若由", "锦官差役": "锦官差役", "雪山弟子": "雪山门人",
  "黑风寨采买": "黑风寨采买", "才旦": "才旦", "苏宛": "苏宛",
  "兰姐": "兰姐", "温掌柜": "温掌柜",
};
const P = (name) => `${BASE}bidders/full/${PORTRAIT_BY_NAME[name] || "温掌柜"}.webp`;

// frame_lux 内窗实测 bbox（x[187,752] y[290,1454] / 941×1672）——立绘 clip 进窗、框叠其上
const WIN = { x: "19.9%", y: "17.3%", w: "60.2%", h: "69.7%" };

// 卡面身份小注（背面信息面用，与 BIDDER_TYPES.bio 相补）
const ROLE_BY_NAME = {
  "李若由": "玉泉小栈经营者 · 现银", "锦官差役": "官差 · 只收武器胚",
  "雪山弟子": "雪山派后生 · 以物易物", "黑风寨采买": "黑风寨外柜 · 人情债",
  "才旦": "鱼定村长之女 · 现银", "苏宛": "苏记茶货铺 · 现银",
  "兰姐": "百花门主 · 附带条件", "温掌柜": "料场庄家 · 回收兜底",
};

const SLOT_LABEL = { top: "上刀", mid: "中刀", bot: "下刀" };
const CHANG_KOU_KEYS = Object.keys(CHANG_KOU);

// 三刀口在石头上的固定位置 + 露肉图的局部偏移（全部百分比，随石头尺寸缩放）
const CUT_POS = {
  top: { top: "18%", left: "40%", jt: "-27%", jl: "-42%" },
  mid: { top: "42%", left: "50%", jt: "-54%", jl: "-77%" },
  bot: { top: "62%", left: "42%", jt: "-85%", jl: "-50%" },
};

// hover 翻面/放大的 CSS（组件内注入）。两条血泪（预览页实证）：
// ① drop-shadow 的 filter 放在带 preserve-3d 的元素上会强制 flat 化、背面永远出不来——阴影只能挂外壳 .gs-tilt；
// ② 父层 scale 过渡 + 子层 rotateY 过渡分开跑会被合成器卡在中途——放大与翻转必须合并在 .gs-flip 同一个 transform 里过渡。
const GS_CSS = `
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
const SHARDS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + (i % 3) * 0.4;
  const r = 55 + (i * 37) % 60;
  return { dx: `${Math.round(Math.cos(a) * r)}%`, dy: `${Math.round(Math.sin(a) * r * 0.8 - 30)}%` };
});
// 品相 → 碎末颜色（纯青绿 / 白米灰 / 杂褐）
const SHARD_COLOR = { chun: "#7dffca", bai: "#e8dfc0", za: "#b07a4a" };
// 揭晓大字（outcome → 字/色）
const OUTCOME_LABEL = { 涨: ["涨", "#7dffca"], 平: ["平", "#e8dfc0"], 垮: ["垮", "#e8a050"], 裂: ["裂!", "#ff6a5a"] };
// 刀口方位 → 刀光角度
const SLASH_ROT = { top: "rotate(-24deg)", mid: "rotate(4deg)", bot: "rotate(21deg)" };

export default function GambleStoneScreen({ building, char, time, zoneTheme, onClose, roomNpcs = [], onTalk, onSettle, onInspect, negotiation = {} }) {
  const luck = (char.special?.气运) ?? 5;
  const money = char.money || 0;
  const hourNow = ((time % 24) + 24) % 24;
  const isNight = hourNow >= 18 || hourNow < 6; // 背景按游戏时辰昼夜切换

  // 每日三石（进场固化；开刀真相出生即定，AI 全程读不到）
  const [dailyStones] = useState(() => {
    const picks = [];
    for (let i = 0; i < 3; i++) {
      const ck = CHANG_KOU_KEYS[Math.floor(Math.random() * CHANG_KOU_KEYS.length)];
      picks.push(birthStone(ck, luck, `${char.name || "guest"}|${time}|${i}`));
    }
    return picks;
  });

  const [selIdx] = useState(0);                 // 进场即上桌第一块
  const stone = selIdx != null ? dailyStones[selIdx] : null;
  const [closed, setClosed] = useState(false);
  const [tick, setTick] = useState(0);          // 开刀动画结束后固化刷新
  const [minimized, setMinimized] = useState(false);
  const [selCard, setSelCard] = useState(null); // 点选放大的竞价者
  const [cutFx, setCutFx] = useState(null);     // 开刀动画进行中：{pos, result}
  const [skinRead, setSkinRead] = useState({}); // 相石评语缓存 {stoneId: text}
  const [carouselIdx, setCarouselIdx] = useState(0); // 竖屏竞价者轮播：当前第几张
  const touchRef = React.useRef({ x: 0, active: false });

  // 赌石是横向沉浸舞台(1672:941的横图大厅)，竖屏手机塞不下会又扁又小。
  // 检测到窄屏且竖持时盖一层温和的"建议横屏"提示，转横屏自动消失。
  const [portraitPhone, setPortraitPhone] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768 && window.innerHeight > window.innerWidth);
  useEffect(() => {
    const onResize = () => setPortraitPhone(window.innerWidth < 768 && window.innerHeight > window.innerWidth);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", onResize); };
  }, []);
  const [skinOpen, setSkinOpen] = useState(false);
  const [skinLoading, setSkinLoading] = useState(false);
  const [bought, setBought] = useState(false);  // 是否已花钱买下当前这块料（第一刀=买下）
  const [buyWarn, setBuyWarn] = useState("");    // 钱不够买石头时的提示

  // 开一刀（系统裁决，AI 不参与）——揭晓真相瞬间写死，动画只是把结果演出来
  // 真赌石：第一刀 = 买下这块毛料并切开。此前相石看皮免费，第一刀落下才付钱，
  // 付了就不退——切开亏赚自负。钱不够买不了这块料。
  function doCut(pos) {
    if (closed || !stone || cutFx) return;      // 动画期间锁刀
    if (!bought) {
      const cost = stone.price || 0;
      if (money < cost) {
        setBuyWarn(`银两不足：买下这块${CHANG_KOU[stone.changKou].label}毛料需 ${cost} 两，你只有 ${money} 两。`);
        return;
      }
      onSettle?.({ type: "buy", price: cost, stone, changKouLabel: CHANG_KOU[stone.changKou].label });
      setBought(true);
      setBuyWarn("");
    }
    const r = cutSlot(stone, pos);
    if (!r) return;
    setCutFx({ pos, result: r });
    setTimeout(() => { setCutFx(null); setTick((t) => t + 1); }, 1450);
  }

  // 相石（看皮）：系统先裁决线索（readSkinClue 按悟性过滤），AI 只演相石口诀，走轻量挂载。
  // 同一块石头只真调一次（缓存），重看免费；首次算一次端详（回合与小纸条由 MudRPG 侧处理）。
  async function doSkinRead() {
    if (!stone) return;
    setSkinOpen(true);
    if (skinRead[stone.id] || skinLoading || !onInspect) return;
    setSkinLoading(true);
    try {
      const clue = readSkinClue(stone, char.special?.悟性 ?? 5);
      const text = await onInspect(stone, clue);
      if (text) setSkinRead((m) => ({ ...m, [stone.id]: text }));
    } finally { setSkinLoading(false); }
  }

  const opened = stone ? stone.slots.filter((s) => s.opened).length : 0;
  // 竞价者：系统裁决报价 → 在场过滤（gambleBidder 分身/兰姐/温掌柜驻场）→ 谈价结果覆盖。
  // 依赖 tick 而非实时 opened：开刀动画期间报价不变，揭晓（动画结束 setTick）才随新信息重骰。
  const nego = (stone && negotiation[stone.id]) || {};
  const priced = useMemo(
    () => (stone && stone.slots.filter((s) => s.opened).length >= 1 && !closed ? rollBidders(stone, luck) : []),
    [stone, closed, luck, tick] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const bidders = priced
    .map((p) => {
      const npc = roomNpcs.find((n) => n.name === p.name);
      if (!npc) return null;
      const offer = nego[p.name] !== undefined ? nego[p.name] : p.offer;
      return { ...p, npc, offer, negotiated: nego[p.name] !== undefined };
    })
    .filter(Boolean);
  const topBidder = bidders.filter((b) => b.offer > 0).sort((a, b) => b.offer - a.offer)[0];

  function offerLabel(b) {
    const tail = b.negotiated ? " ✓谈妥" : "";
    if (b.kind === "noise") return "……看戏";
    if (b.kind === "barter") return "以物易物" + tail;
    if (b.kind === "favor") return `${b.offer} 两 + 人情${tail}`;
    if (b.kind === "condition") return `${b.offer} 两 + 条件${tail}`;
    if (b.kind === "boss") return `兜底 ${b.offer} 两${tail}`;
    return `${b.offer} 两${tail}`;
  }

  // 谈价：赌桌最小化到角标（组件不 unmount，石头 state 保住），走主叙事 act 管线；
  // 谈成的价通过 negotiation prop 流回，展开即见、可按新价结算。
  function startTalk(b) {
    if (closed || b.kind === "noise") return;
    setSelCard(null);
    setMinimized(true);
    onTalk?.(
      b.name,
      `在玉石料场，我上前与${b.name}就这块${SKINS[stone.skin].label}的料子讨价还价`,
      {
        bidderName: b.name, stoneId: stone.id, baseOffer: b.offer, cash: b.cash, carry: b.npc?.carry || [],
        // 轻量挂载语境：谈价轮不走全量世界书，这里带上够 AI 演人的最小人设与局面
        persona: { brief: b.npc?.brief || "", personality: b.npc?.personality || "", bio: b.bio || "", kind: b.kind },
        scene: `玉石料场赌桌前，一块${CHANG_KOU[stone.changKou].label}的${SKINS[stone.skin].label}料，已开${stone.slots.filter(s => s.opened).length}刀（${stone.slots.filter(s => s.opened).map(s => (s.crack ? "见裂" : GRADE[s.grade])).join("、") || "未开"}）`,
      }
    );
  }
  function sellTo(b) {
    if (closed || !b) return;
    setSelCard(null);
    onSettle?.({ type: "sell", price: b.offer, stone, bidderName: b.name });
    setClosed(true);
  }
  function keepStone() {
    // 据为己有：把这块开出的料收进背包（成为玉石原料），日后拿去金玉行打造成玉器。
    // 不再就地花 200 委托做玉器——改成收料，料的种水/品质天花板随物品带走。
    if (closed) return;
    onSettle?.({ type: "keep", stone });
    setClosed(true);
  }

  // ── 最小化：缩成角标，主叙事照常用 ──
  if (minimized) {
    return (
      <div onClick={() => setMinimized(false)}
        style={{ position: "fixed", bottom: 16, right: 16, zIndex: 200, cursor: "pointer",
          background: "#23201b", border: "1px solid #6a5d40", borderRadius: 0, padding: "8px 14px",
          color: "#f0d090", fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,.5)" }}>
        ⬒ 赌桌（{SKINS[stone.skin].label}）· 点击展开
      </div>
    );
  }

  const skinLabel = stone ? SKINS[stone.skin].label : "";
  const changKouLabel = stone ? CHANG_KOU[stone.changKou].label : "";
  const cardFont = "calc(min(100vw, 100vh*1672/941) * 0.011)"; // 背面文字随舞台缩放

  // 单张卡面（front 立绘 / back 信息）——modal 大卡也复用 front 结构
  const CardFront = ({ name }) => (
    <>
      <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h,
        overflow: "hidden", borderRadius: "6% / 4%" }}>
        <img src={P(name)} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      <img src={FRAME} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
    </>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "#0a0806", overflow: "hidden" }}>
      <style>{GS_CSS}</style>

      {/* 顶栏 */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 44, zIndex: 260,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 18px", background: "linear-gradient(180deg,#14120e 60%,transparent)" }}>
        <div style={{ color: "#f0d090", fontSize: 15 }}>玉石料场 · 赌桌
          <span style={{ color: "#6a5d40", fontSize: 12, marginLeft: 8 }}>
            {changKouLabel} · {skinLabel} · 已开{opened}刀{opened >= 1 ? "（悬停卡牌看行情，点卡成交或谈价）" : (bought ? "（点石头或下方按钮开刀）" : `（此料买价 ${stone?.price || 0} 两，落第一刀即买下切开）`)}
          </span>
          {buyWarn && <span style={{ color: "#d4756a", fontSize: 12, marginLeft: 10 }}>{buyWarn}</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setMinimized(true)} style={topBtn}>最小化 ▬</button>
          <button onClick={onClose} style={topBtn}>离场 ✕</button>
        </div>
      </div>

      {/* ── 定比舞台（1672:941）：竖屏钉上半区给轮播腾地，桌面/横屏居中 ── */}
      <div style={portraitPhone
        ? { position: "absolute", top: "7%", left: "50%", transform: "translateX(-50%)",
            aspectRatio: "1672/941", width: "100vw" }
        : { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            aspectRatio: "1672/941", width: "100vw", maxHeight: "100vh", maxWidth: "calc(100vh*1672/941)" }}
        onClick={() => setSelCard(null)}>
        <img src={S(isNight ? "bg_hall_night.webp" : "bg_hall_day.webp")} alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />

        {/* 藏式独脚台（目视定位，桌面盘在台图上部） */}
        <img src={S("table.webp")} alt="" style={{ position: "absolute", left: "50%", top: "33%",
          transform: "translateX(-50%)", width: "31%", zIndex: 10, pointerEvents: "none",
          filter: "drop-shadow(0 14px 26px rgba(0,0,0,.55))" }} />

        {/* 石头：大，坐台面正中；点击三分区开刀。开刀走一套约1.4s的揭晓动画 */}
        {stone && (
          <div className={cutFx ? "gs-shake" : undefined}
            style={{ position: "absolute", left: "50%", top: "1%", transform: "translateX(-50%)",
            width: "23%", aspectRatio: "1/1", zIndex: 12, cursor: closed || cutFx ? "default" : "pointer" }}
            onClick={(e) => {
              e.stopPropagation();
              if (closed) return;
              const r = e.currentTarget.getBoundingClientRect();
              const ry = (e.clientY - r.top) / r.height;
              doCut(ry < 0.36 ? "top" : ry < 0.58 ? "mid" : "bot");
            }}>
            <img src={S(`skin_${stone.skin}.webp`)} alt="皮"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
                imageRendering: "pixelated", filter: "drop-shadow(0 10px 20px rgba(0,0,0,.6))" }} />
            {/* 已开刀口：正在动画的那一刀由动画层接管（开口弹出/露肉渐显/裂纹蔓延），其余静态渲染 */}
            {stone.slots.filter((s) => s.opened).map((sl) => {
              const p = CUT_POS[sl.pos];
              const tier = JADE_TIERS[stone.jadeTier - 1];
              const mask = `url(${S(`cut_${sl.cutShape || 1}.webp`)})`;
              const animating = cutFx && cutFx.pos === sl.pos;
              return (
                <div key={sl.pos} className={animating ? "gs-open" : undefined}
                  style={{ position: "absolute", width: "30%", height: "30%",
                  top: p.top, left: p.left, pointerEvents: "none",
                  WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: "contain", maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }}>
                  <img src={S(`jade_${tier.key}_${tier.code}_${sl.grade}.webp`)} alt="肉"
                    className={animating ? "gs-reveal" : undefined}
                    style={{ position: "absolute", width: "208%", height: "208%", top: p.jt, left: p.jl }} />
                  {sl.crack && <img src={S(`crack_${sl.pos}.webp`)} alt=""
                    className={animating ? "gs-crackfx" : undefined}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />}
                </div>
              );
            })}
            {/* 开刀特效层：刀光扫过 + 尘团 + 碎末粒子（颜色随品相）+ 揭晓大字 */}
            {cutFx && (() => {
              const p = CUT_POS[cutFx.pos];
              const [labelText, labelColor] = OUTCOME_LABEL[cutFx.result.outcome] || ["?", "#e8dfc0"];
              const shardColor = SHARD_COLOR[cutFx.result.grade] || "#e8dfc0";
              return (
                <>
                  <img src={S("fx_cut_light.webp")} alt="" className="gs-slash"
                    style={{ position: "absolute", width: "130%", left: "-15%", top: p.top,
                      "--slash-rot": SLASH_ROT[cutFx.pos] }} />
                  <img src={S("fx_dust.webp")} alt="" className="gs-dust"
                    style={{ position: "absolute", width: "44%", top: p.top, left: p.left,
                      transform: "translate(-25%,-25%)" }} />
                  {SHARDS.map((sh, i) => (
                    <span key={i} className="gs-shard"
                      style={{ top: `calc(${p.top} + 8%)`, left: `calc(${p.left} + 6%)`,
                        background: shardColor, "--dx": sh.dx, "--dy": sh.dy,
                        animationDelay: `${0.2 + (i % 4) * 0.04}s` }} />
                  ))}
                  <div className="gs-label"
                    style={{ position: "absolute", left: "50%", top: "8%",
                      fontSize: "calc(min(100vw, 100vh*1672/941) * 0.052)", fontWeight: "bold",
                      color: labelColor, letterSpacing: 6,
                      textShadow: `0 0 18px ${labelColor}88, 0 3px 8px #000` }}>
                    {labelText}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* ── 卡牌凹半圆 ⌣ 围台：中间靠下、两侧向上抱，轻叠，中间在前 ── */}
        {!portraitPhone && bidders.map((b, i) => {
          const n = bidders.length;
          const half = (n - 1) / 2;
          const t = half > 0 ? (i - half) / half : 0;      // -1 .. 1
          const left = 50 + t * Math.min(41.2, 6.5 * n);   // 人少收拢、人多铺满
          const bottom = 3.5 + 24 * t * t;                 // 抛物线：中间最低（基线抬离底部操作条）
          const rot = -17 * t;                             // 顶朝中心环抱
          const z = Math.round(100 - Math.abs(t) * 40);
          return (
            <div key={b.name} className="gs-seat"
              style={{ position: "absolute", width: "12.6%", left: `${left}%`, bottom: `${bottom}%`,
                zIndex: z, transform: `translateX(-50%) rotate(${rot}deg)`,
                transformOrigin: "bottom center", fontSize: cardFont, cursor: "pointer" }}
              onClick={(e) => { e.stopPropagation(); setSelCard(b); }}>
              <div className="gs-tilt">
                <div className="gs-flip">
                  <div className="gs-face">
                    <CardFront name={b.name} />
                  </div>
                  <div className="gs-face gs-back">
                    <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h,
                      overflow: "hidden", borderRadius: "6% / 4%",
                      background: "radial-gradient(120% 90% at 50% 0%, #3a3020 0%, #201a12 55%, #14100b 100%)" }}>
                      <div style={{ padding: "14% 10%", height: "100%", display: "flex", flexDirection: "column",
                        color: "#e8dfc0", boxSizing: "border-box" }}>
                        <div style={{ fontSize: "1.15em", color: "#f0d090", letterSpacing: 2, marginBottom: "4%" }}>{b.name}</div>
                        <div style={{ fontSize: ".62em", color: "#c0a060", marginBottom: "7%" }}>{ROLE_BY_NAME[b.name] || ""}</div>
                        <div style={{ fontSize: ".95em", color: "#ffd77a", marginBottom: "7%" }}>出价 {offerLabel(b)}</div>
                        <div style={{ fontSize: ".60em", lineHeight: 1.75, color: "#cdc2a2" }}>{b.bio}</div>
                        <div style={{ marginTop: "auto", fontSize: ".52em", color: "#8a7d5a" }}>点击卡牌 · 成交或谈判</div>
                      </div>
                    </div>
                    <img src={FRAME} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
                  </div>
                </div>
                {/* 报价气泡（卡下方，bub_gold1 统一款） */}
                <div style={{ position: "relative", width: "92%", margin: "-2% auto 0", aspectRatio: "337/200",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  textAlign: "center", zIndex: 5 }}>
                  <img src={UI("bub_gold1.webp")} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: -1 }} />
                  <div style={{ fontSize: ".72em", fontWeight: "bold", color: "#7a5320", lineHeight: 1.1, marginTop: "-9%" }}>{b.name}</div>
                  <div style={{ fontSize: ".80em", fontWeight: "bold", color: "#4a2d0a", lineHeight: 1.25 }}>{offerLabel(b)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 竖屏专用：竞价者轮播（一次一张·手指左右滑·箭头·圆点） ── */}
      {portraitPhone && bidders.length > 0 && (() => {
        const cur = bidders[Math.min(carouselIdx, bidders.length - 1)];
        const go = (d) => setCarouselIdx((i) => (i + d + bidders.length) % bidders.length);
        return (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 82, top: "56%", zIndex: 255,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 8px" }}
            onTouchStart={(e) => { touchRef.current = { x: e.touches[0].clientX, active: true }; }}
            onTouchEnd={(e) => {
              if (!touchRef.current.active) return;
              const dx = e.changedTouches[0].clientX - touchRef.current.x;
              touchRef.current.active = false;
              if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); // 左滑下一张、右滑上一张
            }}>
            <div style={{ color: "#c0a060", fontSize: 12, marginBottom: 6, letterSpacing: 1 }}>
              买家 {carouselIdx + 1} / {bidders.length} · 左右滑动看下一位
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center" }}>
              {bidders.length > 1 && (
                <button onClick={() => go(-1)} style={carArrow}>‹</button>
              )}
              {/* 当前卡：立绘 + 报价 + 简介 + 操作 */}
              <div style={{ flex: "0 1 220px", maxWidth: 220, background: "rgba(26,22,16,.95)",
                border: "1px solid #6a5d40", borderRadius: 0, padding: 12, boxShadow: "0 8px 28px rgba(0,0,0,.6)" }}>
                <div style={{ position: "relative", width: "100%", aspectRatio: "941/1672", maxHeight: "34vh",
                  margin: "0 auto", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, overflow: "hidden", borderRadius: "6% / 4%" }}>
                    <img src={P(cur.name)} alt={cur.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <img src={FRAME} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
                </div>
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <div style={{ color: "#f0d090", fontSize: 16, letterSpacing: 2 }}>{cur.name}</div>
                  <div style={{ color: "#a08a5a", fontSize: 11 }}>{ROLE_BY_NAME[cur.name] || ""}</div>
                  <div style={{ color: "#ffd77a", fontSize: 15, margin: "6px 0" }}>出价 {offerLabel(cur)}</div>
                  <div style={{ color: "#cdc2a2", fontSize: 11, lineHeight: 1.7, maxHeight: "8vh", overflowY: "auto" }}>{cur.bio}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  <button onClick={() => sellTo(cur)} style={{ ...carBtn, background: "linear-gradient(180deg,#c8a860,#8a6a2a)", color: "#3a2408" }}>
                    ✓ 接受 {offerLabel(cur)}
                  </button>
                  {cur.kind !== "noise" && (
                    <button onClick={() => startTalk(cur)} style={{ ...carBtn, background: "rgba(60,48,28,.9)", color: "#f0e0b0", border: "1px solid #6a5d40" }}>
                      🗣 与{cur.name}谈价
                    </button>
                  )}
                </div>
              </div>
              {bidders.length > 1 && (
                <button onClick={() => go(1)} style={carArrow}>›</button>
              )}
            </div>
            {/* 圆点指示 */}
            {bidders.length > 1 && (
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {bidders.map((_, i) => (
                  <div key={i} onClick={() => setCarouselIdx(i)}
                    style={{ width: 8, height: 8, borderRadius: "50%", cursor: "pointer",
                      background: i === carouselIdx ? "#f0d090" : "rgba(255,255,255,.25)" }} />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── 相石评语弹层：系统裁决线索、AI 演口诀（轻量挂载，一石一次缓存） ── */}
      {skinOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 290, background: "rgba(5,4,2,.55)",
          display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setSkinOpen(false)}>
          <div style={{ maxWidth: "min(560px, 82vw)", background: "#1e1a13", border: "1px solid #6a5d40",
            borderRadius: 0, padding: "22px 26px", boxShadow: "0 12px 40px rgba(0,0,0,.7)" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ color: "#f0d090", fontSize: 15, letterSpacing: 2, marginBottom: 12 }}>
              相石 · {changKouLabel} · {skinLabel}
            </div>
            <div style={{ color: "#cdc2a2", fontSize: 13.5, lineHeight: 2, whiteSpace: "pre-wrap" }}>
              {skinRead[stone?.id] || (skinLoading ? "老师傅眯眼端详，指腹在皮壳上缓缓摩挲……" : "（相石不语）")}
            </div>
            <div style={{ color: "#6a5d40", fontSize: 11, marginTop: 12, letterSpacing: 1 }}>
              看皮只断表象，种水深浅终归要刀下见真章 · 点空白处收起
            </div>
          </div>
        </div>
      )}

      {/* ── 点选放大：大卡 + 成交/谈价抉择 ── */}
      {selCard && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(5,4,2,.72)",
          backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", gap: "3vw" }}
          onClick={() => setSelCard(null)}>
          <div style={{ height: "84vh", aspectRatio: "941/1672", position: "relative",
            filter: "drop-shadow(0 18px 40px rgba(0,0,0,.8))" }} onClick={(e) => e.stopPropagation()}>
            <CardFront name={selCard.name} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2.4vh", maxWidth: "30vw" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ color: "#f0d090", fontSize: "3.2vh", letterSpacing: 3 }}>{selCard.name}</div>
            <div style={{ color: "#a08a5a", fontSize: "1.7vh", marginTop: "-1.2vh" }}>{ROLE_BY_NAME[selCard.name] || ""}</div>
            <div style={{ color: "#ffd77a", fontSize: "2.3vh" }}>出价 {offerLabel(selCard)}</div>
            <div style={{ color: "#cdc2a2", fontSize: "1.6vh", lineHeight: 2 }}>{selCard.bio}</div>
            <button onClick={() => sellTo(selCard)} style={{ ...actBtn, backgroundImage: `url(${UI("bar_paper.webp")})`, color: "#4a2d0a" }}>
              ✓ 接受报价 · {offerLabel(selCard)}
            </button>
            {selCard.kind !== "noise" && (
              <button onClick={() => startTalk(selCard)} style={{ ...actBtn, backgroundImage: `url(${UI("bar_wood.webp")})`, color: "#f0e0b0", textShadow: "0 1px 2px #000" }}>
                🗣 与{selCard.name}谈价
              </button>
            )}
            <div style={{ color: "#6a5d40", fontSize: "1.3vh" }}>谈价走主对话（赌桌自动收起，谈妥的价回来即见）</div>
          </div>
        </div>
      )}

      {/* 底部操作条：三刀 + 快捷卖最高 + 据为己有 */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 74, zIndex: 250,
        background: "linear-gradient(0deg,#1a1712 70%,transparent)",
        display: "flex", alignItems: "center", gap: 12, justifyContent: "center", padding: "0 16px" }}>
        <PanelBtn img={UI("bar_wood.webp")} kind="wood" disabled={!stone || closed} onClick={doSkinRead}>
          {skinLoading ? "相石中…" : "相石 · 看皮"}
        </PanelBtn>
        {["top", "mid", "bot"].map((pos) => {
          const sl = stone?.slots.find((s) => s.pos === pos);
          const done = sl?.opened;
          const gl = done ? (sl.crack ? "裂" : GRADE[sl.grade]) : "";
          return (
            <PanelBtn key={pos} img={UI("bar_wood.webp")} kind="wood"
              disabled={done || closed || !!cutFx} done={done} grade={sl?.grade} crack={sl?.crack}
              onClick={() => doCut(pos)}>
              {SLOT_LABEL[pos]}{done ? `·${gl}` : ""}
            </PanelBtn>
          );
        })}
        <div style={{ width: 10 }} />
        {!closed && topBidder && (
          <PanelBtn img={UI("bar_paper.webp")} kind="paper" big onClick={() => sellTo(topBidder)}>
            卖给最高价（{topBidder.name} {topBidder.offer}两）
          </PanelBtn>
        )}
        {!closed && (
          <PanelBtn img={UI("bar_paper.webp")} kind="paper" big onClick={keepStone}>
            据为己有 · 收料入行囊
          </PanelBtn>
        )}
      </div>
    </div>
  );
}

function PanelBtn({ img, kind, big, disabled, done, grade, crack, onClick, children }) {
  const color = kind === "paper" ? "#5a3d1a" : "#f0e0b0";
  const doneColor = done ? (crack ? "#ffb090" : grade === "chun" ? "#7dffca" : grade === "za" ? "#ffb090" : "#e8dfc0") : color;
  return (
    <div onClick={disabled ? undefined : onClick}
      style={{ position: "relative", height: 52, minWidth: big ? 160 : 120, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer", color: doneColor, fontSize: 13, fontWeight: "bold",
        textShadow: kind === "paper" ? "0 1px 0 rgba(255,255,255,.3)" : "0 1px 2px #000",
        backgroundImage: `url(${img})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
        filter: done ? "brightness(.8)" : "none", padding: "0 20px",
        transition: "transform .12s, filter .12s", opacity: disabled && !done ? 0.5 : 1 }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.filter = "brightness(1.12)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.filter = done ? "brightness(.8)" : "none"; }}>
      {children}
    </div>
  );
}

const topBtn = { background: "none", border: "1px solid #4a443a", color: "#c9bfa8", borderRadius: 0, padding: "4px 12px", cursor: "pointer", fontSize: 12 };
const carArrow = { flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: "1px solid #6a5d40",
  background: "rgba(20,16,11,.9)", color: "#f0d090", fontSize: 22, lineHeight: 1, cursor: "pointer", userSelect: "none" };
const carBtn = { width: "100%", padding: "10px 0", border: "none", borderRadius: 0, fontSize: 14, fontWeight: "bold", cursor: "pointer" };
const actBtn = { position: "relative", height: "6.4vh", minWidth: "24vh", border: "none", cursor: "pointer",
  background: "transparent", display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "1.9vh", fontWeight: "bold", fontFamily: "inherit", letterSpacing: 2,
  backgroundSize: "100% 100%", backgroundRepeat: "no-repeat", transition: "transform .15s, filter .15s" };
