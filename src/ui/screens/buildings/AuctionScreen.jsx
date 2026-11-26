import React, { useState, useRef, useEffect } from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import {
  AUCTION_CONFIG, AUCTION_LOT, AUCTION_PHASE,
  initAuction, openAuction, playerBid, abandonAuction, nextBidAmount,
} from "../../../domain/rules/economy/auction.js";
import { invHasItemNamed } from "../../../domain/rules/map/safeHouse.js";

// 宝丰拍卖行——锦官城，聚宝当铺隔壁。目前只拍一件东西：衔尾蛇门环（蜀王庄钥匙）。
// 竞价状态机在 ../auction.js（纯函数、可测），这里只管画和收结果。
// 拍到之后由 onWin 交给 MudRPG 做结算（扣银、入袋、写日志、交给 AI 叙事）。
export default function AuctionScreen({ building, char, inv, onClose, inline, onWin }) {
  const [st, setSt] = useState(initAuction);
  const [err, setErr] = useState(null);
  const settledRef = useRef(false); // 防止 StrictMode 双跑 / 连点导致重复结算
  const logEndRef = useRef(null);

  const money = char.money || 0;
  const owned = invHasItemNamed(inv, AUCTION_LOT.name);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [st.log.length]);

  // 落槌即结算，只结一次。
  useEffect(() => {
    if (st.phase === AUCTION_PHASE.WON && !settledRef.current) {
      settledRef.current = true;
      onWin?.(st.currentBid);
    }
  }, [st.phase, st.currentBid, onWin]);

  const doBid = (amount) => {
    const r = playerBid(st, money, amount);
    setErr(r.error);
    if (!r.error) setSt(r.state);
  };

  const next = nextBidAmount(st);

  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name={building?.name || "宝丰拍卖行"} onClose={onClose} />
      <div style={{ padding: "14px 16px", fontSize: "var(--fs-md)", lineHeight: 1.85, color: "var(--text)" }}>

        {owned ? (
          <div style={{ color: "var(--text-dim)" }}>
            今日的拍品你已经拍下了。厅里换了一批人，台上摆的是些寻常字画瓷器，没什么好看的。
          </div>
        ) : (
          <>
            {/* 拍品 */}
            <div style={{
              border: `1px solid var(--border)`, borderRadius: 0,
              padding: "10px 12px", marginBottom: 12, background: "rgba(255,255,255,.02)",
            }}>
              <div style={{ color: "var(--violet)", fontSize: "var(--fs-md)", marginBottom: 4 }}>
                【拍品】{AUCTION_LOT.name}　<span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>{AUCTION_LOT.quality}档</span>
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-sm)" }}>{AUCTION_LOT.blurb}</div>
            </div>

            {/* 价目 */}
            <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: "var(--fs-sm)" }}>
              <span style={{ color: "var(--text-dim)" }}>起拍 <span style={{ color: "var(--text)" }}>{AUCTION_CONFIG.startingBid}</span> 两</span>
              <span style={{ color: "var(--text-dim)" }}>一口价 <span style={{ color: "var(--gold)" }}>{AUCTION_CONFIG.buyoutPrice}</span> 两</span>
              <span style={{ flex: 1 }} />
              <span style={{ color: money >= next ? "var(--clay)" : "var(--ink-danger-soft)" }}>随身 {money} 两</span>
            </div>

            {/* 竞价记录 */}
            <div style={{
              maxHeight: 200, overflowY: "auto", border: `1px solid var(--border)`,
              borderRadius: 0, padding: "8px 10px", marginBottom: 10, background: "rgba(0,0,0,.15)",
            }}>
              {st.log.length === 0 && (
                <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-sm)" }}>
                  厅里坐了七八成满。台上那件东西还盖着红布。司仪正在清嗓子。
                </div>
              )}
              {st.log.map((l, i) => (
                <div key={i} style={{ fontSize: "var(--fs-sm)", marginBottom: 4,
                color: l.who === "player" ? "var(--clay)" : l.who === "shill" ? "var(--ink-brass-lit)" : "var(--text-dim)", }}>{l.text}</div>
              ))}
              <div ref={logEndRef} />
            </div>

            {st.phase === AUCTION_PHASE.BIDDING && (
              <div style={{ marginBottom: 8, fontSize: "var(--fs-sm)" }}>
                当前价 <span style={{ color: "var(--gold)", fontSize: "var(--fs-base)" }}>{st.currentBid}</span> 两
                <span style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)" }}>
                  　（{st.leader === "player" ? "你出的价" : "灰绸胖子出的价"}）
                </span>
              </div>
            )}

            {err && <div style={{ color: "var(--ink-danger-soft)", fontSize: "var(--fs-sm)", marginBottom: 8 }}>{err}</div>}

            {/* 操作 */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {st.phase === AUCTION_PHASE.IDLE && (
                <Btn label="入座，等开槌" onClick={() => setSt(openAuction(st))} />
              )}
              {st.phase === AUCTION_PHASE.BIDDING && (
                <>
                  <Btn label={`加价到 ${next} 两`} onClick={() => doBid()}
                    disabled={money < next} />
                  {st.currentBid < AUCTION_CONFIG.buyoutPrice && (
                    <Btn label={`一口价 ${AUCTION_CONFIG.buyoutPrice} 两`} onClick={() => doBid(AUCTION_CONFIG.buyoutPrice)}
                      disabled={money < AUCTION_CONFIG.buyoutPrice} secondary />
                  )}
                  <Btn label="算了，不要了" onClick={() => setSt(abandonAuction(st))} secondary />
                </>
              )}
              {st.phase === AUCTION_PHASE.WON && (
                <div style={{ color: "var(--clay)", fontSize: "var(--fs-sm)" }}>
                  ✦ 以 {st.currentBid} 两拍得「{AUCTION_LOT.name}」。
                </div>
              )}
              {st.phase === AUCTION_PHASE.LOST && (
                <>
                  <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-sm)", width: "100%" }}>
                    流拍了。掌槌的说过些日子还会再上一次。
                  </div>
                  <Btn label="再看一次" onClick={() => { setSt(initAuction()); setErr(null); }} secondary />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}
