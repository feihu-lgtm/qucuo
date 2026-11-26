// 玉石料场赌桌：状态与裁决入口（买石/开刀/相石/谈价/卖石/收料）。
// 视觉子组件在 GambleStoneParts.jsx，素材与样式常量在 gambleStoneAssets.js。
import React, { useState, useMemo, useEffect } from "react";
import { random } from "../../../utils/rng.js";
import {
  CHANG_KOU, SKINS, GRADE,
  birthStone, cutSlot, rollBidders, readSkinClue,
} from "../../../domain/rules/economy/gambleStone.js";
import {
  S, UI, GS_CSS, CHANG_KOU_KEYS, SLOT_LABEL, topBtn,
} from "./gambleStoneAssets.js";
import {
  StoneVisual, BidderFan, BidderCarousel, SkinModal, SelCardModal, PanelBtn,
} from "./GambleStoneParts.jsx";

export default function GambleStoneScreen({ building, char, time, zoneTheme, onClose, roomNpcs = [], onTalk, onSettle, onInspect, onMinimizeChange, negotiation = {} }) {
  const luck = (char.special?.气运) ?? 5;
  const money = char.money || 0;
  const hourNow = ((time % 24) + 24) % 24;
  const isNight = hourNow >= 18 || hourNow < 6; // 背景按游戏时辰昼夜切换

  // 每日三石（进场固化；开刀真相出生即定，AI 全程读不到）
  const [dailyStones] = useState(() => {
    const picks = [];
    for (let i = 0; i < 3; i++) {
      const ck = CHANG_KOU_KEYS[Math.floor(random() * CHANG_KOU_KEYS.length)];
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
  const minimizeTable = () => {
    setMinimized(true);
    onMinimizeChange?.(true);
  };
  const restoreTable = () => {
    setMinimized(false);
    onMinimizeChange?.(false);
  };
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
    [stone, closed, luck, tick]
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
    minimizeTable();
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
    // 角标定位与层级在 tokens.css 的 .gamble-minimized-chip（screen 档，原 z 200）。
    return (
      <div className="mobile-gamble-minimized gamble-minimized-chip" onClick={restoreTable}
        style={{ cursor: "pointer",
          background: "var(--gamble-toast-bg)", border: "1px solid var(--ink-brass)", borderRadius: 0, padding: "8px 14px",
          color: "var(--gold-light)", fontSize: "var(--fs-md)", boxShadow: "0 4px 16px rgba(0,0,0,.5)" }}>
        ⬒ 赌桌（{SKINS[stone.skin].label}）· 点击展开
      </div>
    );
  }

  const skinLabel = stone ? SKINS[stone.skin].label : "";
  const changKouLabel = stone ? CHANG_KOU[stone.changKou].label : "";
  const cardFont = "calc(min(100vw, 100vh*1672/941) * 0.011)"; // 背面文字随舞台缩放

  // 赌桌是整屏舞台而不是弹窗（没有遮罩、不响应点空白关闭），定位与层级在 tokens.css 的
    // .gamble-stage（screen 档，原 z 200）。舞台本身是层叠上下文，里面的弹窗层级只在舞台内比较。
  return (
    <div className="gamble-stage" data-blocking-layer="true" style={{ background: "var(--gamble-bg)", overflow: "hidden" }}>
      <style>{GS_CSS}</style>

      {/* 顶栏 */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 44, zIndex: 260,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 18px", background: "linear-gradient(180deg,var(--gamble-top) 60%,transparent)" }}>
        <div style={{ color: "var(--gold-light)", fontSize: "var(--fs-lg)" }}>玉石料场 · 赌桌
          <span style={{ color: "var(--ink-brass)", fontSize: "var(--fs-sm)", marginLeft: 8 }}>
            {changKouLabel} · {skinLabel} · 已开{opened}刀{opened >= 1 ? "（悬停卡牌看行情，点卡成交或谈价）" : (bought ? "（点石头或下方按钮开刀）" : `（此料买价 ${stone?.price || 0} 两，落第一刀即买下切开）`)}
          </span>
          {buyWarn && <span style={{ color: "var(--ink-rose)", fontSize: "var(--fs-sm)", marginLeft: 10 }}>{buyWarn}</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={minimizeTable} style={topBtn}>最小化 ▬</button>
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

        <StoneVisual stone={stone} closed={closed} cutFx={cutFx} doCut={doCut} />

        {/* ── 卡牌凹半圆 ⌣ 围台（桌面/横屏）：中间靠下、两侧向上抱，轻叠，中间在前 ── */}
        {!portraitPhone && (
          <BidderFan bidders={bidders} cardFont={cardFont} offerLabel={offerLabel} onSelect={setSelCard} />
        )}
      </div>

      {/* ── 竖屏专用：竞价者轮播（一次一张·手指左右滑·箭头·圆点） ── */}
      {portraitPhone && bidders.length > 0 && (
        <BidderCarousel bidders={bidders} carouselIdx={carouselIdx} setCarouselIdx={setCarouselIdx}
          touchRef={touchRef} offerLabel={offerLabel} sellTo={sellTo} startTalk={startTalk} />
      )}

      {/* ── 相石评语弹层：系统裁决线索、AI 演口诀（轻量挂载，一石一次缓存） ── */}
      {skinOpen && (
        <SkinModal changKouLabel={changKouLabel} skinLabel={skinLabel}
          text={skinRead[stone?.id]} loading={skinLoading} onClose={() => setSkinOpen(false)} />
      )}

      {/* ── 点选放大：大卡 + 成交/谈价抉择 ── */}
      {selCard && (
        <SelCardModal card={selCard} offerLabel={offerLabel} sellTo={sellTo}
          startTalk={startTalk} onClose={() => setSelCard(null)} />
      )}

      {/* 底部操作条：三刀 + 快捷卖最高 + 据为己有 */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 74, zIndex: 250,
        background: "linear-gradient(0deg,var(--gamble-bottom) 70%,transparent)",
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
