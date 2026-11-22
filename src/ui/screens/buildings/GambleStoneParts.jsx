// 赌石屏的子组件：石头视觉、竞价者卡牌（桌面扇形/竖屏轮播）、放大抉择、相石弹层、操作按钮。
// 从 GambleStoneScreen.jsx 拆出；所有样式常量来自 gambleStoneAssets.js，行为与原实现一致。
import { JADE_TIERS, GRADE } from "../../../domain/rules/economy/gambleStone.js";
import {
  S, UI, FRAME, P, WIN, ROLE_BY_NAME,
  CUT_POS, SHARDS, SHARD_COLOR, OUTCOME_LABEL, SLASH_ROT,
  carArrow, carBtn, actBtn,
} from "./gambleStoneAssets.js";

// 单张卡面（front 立绘 / back 信息）——modal 大卡也复用 front 结构
export function CardFront({ name }) {
  return (
    <>
      <div style={{ position: "absolute", left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h,
        overflow: "hidden", borderRadius: "6% / 4%" }}>
        <img src={P(name)} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
      <img src={FRAME} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
    </>
  );
}

// 石头：大，坐台面正中；点击三分区开刀。开刀走一套约1.4s的揭晓动画
export function StoneVisual({ stone, closed, cutFx, doCut }) {
  if (!stone) return null;
  return (
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
                textShadow: `0 0 18px ${labelColor}88, 0 3px 8px var(--black)` }}>
              {labelText}
            </div>
          </>
        );
      })()}
    </div>
  );
}

// ── 桌面/横屏：卡牌凹半圆 ⌣ 围台：中间靠下、两侧向上抱，轻叠，中间在前 ──
export function BidderFan({ bidders, cardFont, offerLabel, onSelect }) {
  return bidders.map((b, i) => {
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
        onClick={(e) => { e.stopPropagation(); onSelect(b); }}>
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
                  <div style={{ fontSize: "1.15em", color: "var(--gold-light)", letterSpacing: 2, marginBottom: "4%" }}>{b.name}</div>
                  <div style={{ fontSize: ".62em", color: "var(--parchment)", marginBottom: "7%" }}>{ROLE_BY_NAME[b.name] || ""}</div>
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
  });
}

// ── 竖屏专用：竞价者轮播（一次一张·手指左右滑·箭头·圆点） ──
export function BidderCarousel({ bidders, carouselIdx, setCarouselIdx, touchRef, offerLabel, sellTo, startTalk }) {
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
      <div style={{ color: "var(--parchment)", fontSize: 12, marginBottom: 6, letterSpacing: 1 }}>
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
            <div style={{ color: "var(--gold-light)", fontSize: 16, letterSpacing: 2 }}>{cur.name}</div>
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
                background: i === carouselIdx ? "var(--gold-light)" : "rgba(255,255,255,.25)" }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 相石评语弹层：系统裁决线索、AI 演口诀（轻量挂载，一石一次缓存） ──
export function SkinModal({ changKouLabel, skinLabel, text, loading, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 290, background: "rgba(5,4,2,.55)",
      display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ maxWidth: "min(560px, 82vw)", background: "#1e1a13", border: "1px solid #6a5d40",
        borderRadius: 0, padding: "22px 26px", boxShadow: "0 12px 40px rgba(0,0,0,.7)" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ color: "var(--gold-light)", fontSize: 15, letterSpacing: 2, marginBottom: 12 }}>
          相石 · {changKouLabel} · {skinLabel}
        </div>
        <div style={{ color: "#cdc2a2", fontSize: 13.5, lineHeight: 2, whiteSpace: "pre-wrap" }}>
          {text || (loading ? "老师傅眯眼端详，指腹在皮壳上缓缓摩挲……" : "（相石不语）")}
        </div>
        <div style={{ color: "#6a5d40", fontSize: 11, marginTop: 12, letterSpacing: 1 }}>
          看皮只断表象，种水深浅终归要刀下见真章 · 点空白处收起
        </div>
      </div>
    </div>
  );
}

// ── 点选放大：大卡 + 成交/谈价抉择 ──
export function SelCardModal({ card, offerLabel, sellTo, startTalk, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(5,4,2,.72)",
      backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", gap: "3vw" }}
      onClick={onClose}>
      <div style={{ height: "84vh", aspectRatio: "941/1672", position: "relative",
        filter: "drop-shadow(0 18px 40px rgba(0,0,0,.8))" }} onClick={(e) => e.stopPropagation()}>
        <CardFront name={card.name} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "2.4vh", maxWidth: "30vw" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ color: "var(--gold-light)", fontSize: "3.2vh", letterSpacing: 3 }}>{card.name}</div>
        <div style={{ color: "#a08a5a", fontSize: "1.7vh", marginTop: "-1.2vh" }}>{ROLE_BY_NAME[card.name] || ""}</div>
        <div style={{ color: "#ffd77a", fontSize: "2.3vh" }}>出价 {offerLabel(card)}</div>
        <div style={{ color: "#cdc2a2", fontSize: "1.6vh", lineHeight: 2 }}>{card.bio}</div>
        <button onClick={() => sellTo(card)} style={{ ...actBtn, backgroundImage: `url(${UI("bar_paper.webp")})`, color: "#4a2d0a" }}>
          ✓ 接受报价 · {offerLabel(card)}
        </button>
        {card.kind !== "noise" && (
          <button onClick={() => startTalk(card)} style={{ ...actBtn, backgroundImage: `url(${UI("bar_wood.webp")})`, color: "#f0e0b0", textShadow: "0 1px 2px var(--black)" }}>
            🗣 与{card.name}谈价
          </button>
        )}
        <div style={{ color: "#6a5d40", fontSize: "1.3vh" }}>谈价走主对话（赌桌自动收起，谈妥的价回来即见）</div>
      </div>
    </div>
  );
}

export function PanelBtn({ img, kind, big, disabled, done, grade, crack, onClick, children }) {
  const color = kind === "paper" ? "#5a3d1a" : "#f0e0b0";
  const doneColor = done ? (crack ? "#ffb090" : grade === "chun" ? "#7dffca" : grade === "za" ? "#ffb090" : "#e8dfc0") : color;
  return (
    <div onClick={disabled ? undefined : onClick}
      style={{ position: "relative", height: 52, minWidth: big ? 160 : 120, display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer", color: doneColor, fontSize: 13, fontWeight: "bold",
        textShadow: kind === "paper" ? "0 1px 0 rgba(255,255,255,.3)" : "0 1px 2px var(--black)",
        backgroundImage: `url(${img})`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
        filter: done ? "brightness(.8)" : "none", padding: "0 20px",
        transition: "transform .12s, filter .12s", opacity: disabled && !done ? 0.5 : 1 }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.filter = "brightness(1.12)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.filter = done ? "brightness(.8)" : "none"; }}>
      {children}
    </div>
  );
}
