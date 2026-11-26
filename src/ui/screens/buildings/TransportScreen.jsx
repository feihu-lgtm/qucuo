import React, { useState } from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { canTravelByCarriage, getPriceForDest } from "../../../features/buildings/logic.js";

// 驿站（原「马车行」）：车马传送 + 邮传（买鸽子 / 寄信 / 送礼+信）合一。
// 车马：花银两直接传送到已探索据点，不触发随机遭遇。
// 邮传：在驿站可给相识之人寄信、或随信送礼（慢，达者按距离 1–12 时辰回信/回礼）；
//       也可在此购买信鸽——买了鸽子才能在野外随处「飞鸽传书」（快，但只送信、不带礼）。
const PIGEON_PRICE = 12; // 一只信鸽的价钱

export default function TransportScreen({
  building, char, mapData, currentRoom, flags, questProgress, zoneTheme, onClose, inline, onTravel,
  inv = [], metNpcs = [], onBuyPigeon, onSendLetter,
}) {
  const money = char.money || 0;
  const pigeons = char.pigeons || 0;
  const destinations = Object.keys(mapData).filter(name =>
    name !== currentRoom && canTravelByCarriage({ mapData, flags, questProgress }, name));

  const [tab, setTab] = useState("post"); // 'ride' 车马 | 'post' 邮传
  const [recipient, setRecipient] = useState(metNpcs[0] || "");
  const [letter, setLetter] = useState("");
  const [gift, setGift] = useState(""); // 附礼物品名，空=只寄信

  const invNames = inv.map(i => (typeof i === "object" ? i.name : i)).filter(Boolean);

  const doSend = () => {
    if (!recipient) return;
    if (!letter.trim()) return;
    onSendLetter && onSendLetter({
      npcName: recipient,
      content: letter.trim(),
      channel: gift ? "postgift" : "post",
      gift: gift || null,
    });
    setLetter(""); setGift("");
    onClose && onClose();
  };

  const tabBtn = (id, label) => (
    <span onClick={() => setTab(id)} style={{
      cursor: "pointer", padding: "4px 12px", fontSize: "var(--fs-sm)", borderRadius: 0,
      color: tab === id ? zoneTheme.bg : zoneTheme.accent,
      background: tab === id ? zoneTheme.accent : zoneTheme.bgPanel,
      border: `1px solid ${zoneTheme.border}`,
    }}>{label}</span>
  );

  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name={building.name} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "var(--ink-text-dim)", marginBottom: 10, fontSize: "var(--fs-xs)" }}>
          银两 {money} 两 · 信鸽 {pigeons} 只 · 当前位置：{currentRoom}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {tabBtn("post", "邮传")}
          {tabBtn("ride", "车马")}
        </div>

        {tab === "ride" && (
          <>
            <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 10 }}>选择目的地（不经过随机遭遇，直接抵达）：</div>
            {destinations.length === 0 && <div style={{ color: "var(--ink-text-dim)" }}>没有可乘车前往的据点。</div>}
            {destinations.map(dest => {
              const price = getPriceForDest(dest);
              return (
                <div key={dest} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "8px 10px", background: "var(--bg-ink)", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
                  <span style={{ color: "var(--ink-text)", fontSize: "var(--fs-sm)" }}>{dest}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--gold-bright)", fontSize: "var(--fs-xs)" }}>{price} 两</span>
                    <Btn label="前往" disabled={money < price} onClick={() => onTravel(dest, price)} />
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === "post" && (
          <>
            {/* 买鸽子 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "8px 10px", background: "var(--bg-ink)", borderRadius: 0, border: `1px solid ${zoneTheme.border}` }}>
              <div>
                <div style={{ color: "var(--gold)", fontSize: "var(--fs-sm)" }}>🕊 信鸽 <span style={{ color: "var(--ink-text-dim)" }}>（现有 {pigeons} 只）</span></div>
                <div style={{ color: "var(--ink-moss)", fontSize: "var(--fs-2xs)" }}>买了才能在野外随处飞鸽传书（快·只送信）；每寄一封耗一只</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--gold-bright)", fontSize: "var(--fs-xs)" }}>{PIGEON_PRICE} 两/只</span>
                <Btn label="买1只" disabled={money < PIGEON_PRICE} onClick={() => onBuyPigeon && onBuyPigeon(1, PIGEON_PRICE)} />
                <Btn label="买5只" disabled={money < PIGEON_PRICE * 5} onClick={() => onBuyPigeon && onBuyPigeon(5, PIGEON_PRICE)} />
              </div>
            </div>

            {/* 寄信 / 送礼 */}
            <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", marginBottom: 8 }}>
              驿站寄书：给相识之人写信，或随信附一件礼（走驿卒脚程，按远近 1–12 时辰后有回音；情谊够深者或有回礼）。
            </div>
            {metNpcs.length === 0 ? (
              <div style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)" }}>你还没结识可通信的人。</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", width: 40 }}>收信人</span>
                  <select value={recipient} onChange={e => setRecipient(e.target.value)}
                    style={{ flex: 1, background: "var(--bg-ink)", color: "var(--ink-text)", border: `1px solid ${zoneTheme.border}`, borderRadius: 0, padding: "4px 6px", fontSize: "var(--fs-sm)", fontFamily: "inherit" }}>
                    {metNpcs.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)", width: 40 }}>附礼</span>
                  <select value={gift} onChange={e => setGift(e.target.value)}
                    style={{ flex: 1, background: "var(--bg-ink)", color: gift ? "var(--gold)" : "var(--ink-moss)", border: `1px solid ${zoneTheme.border}`, borderRadius: 0, padding: "4px 6px", fontSize: "var(--fs-sm)", fontFamily: "inherit" }}>
                    <option value="">（不附礼 · 只寄信）</option>
                    {invNames.map((n, i) => <option key={n + i} value={n}>{n}</option>)}
                  </select>
                </div>
                <textarea value={letter} onChange={e => setLetter(e.target.value)}
                  placeholder={`写给${recipient || "…"}的话…`}
                  rows={4}
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-ink)", color: "var(--ink-text)", border: `1px solid ${zoneTheme.border}`, borderRadius: 0, padding: 8, fontSize: "var(--fs-sm)", fontFamily: "inherit", resize: "vertical", marginBottom: 8 }} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Btn label={gift ? "送礼 + 寄信" : "寄信"} disabled={!recipient || !letter.trim()} onClick={doSend} />
                </div>
              </>
            )}
          </>
        )}

        <div style={{ color: "var(--building-desc)", fontSize: "var(--fs-2xs)", marginTop: 12 }}>{building.desc}</div>
      </div>
    </Overlay>
  );
}
