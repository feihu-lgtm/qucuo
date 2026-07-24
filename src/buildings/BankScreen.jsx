import React, { useState } from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

// 钱庄：存取银两，每24时间单位生息2%
export default function BankScreen({ building, char, time, deposit, depositedAt, zoneTheme, onClose, inline, onDeposit, onWithdraw }) {
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState("deposit");
  const money = char.money || 0;

  const elapsed = depositedAt != null ? Math.floor((time - depositedAt) / 24) : 0;
  const interest = deposit > 0 ? Math.floor(deposit * (Math.pow(1.02, elapsed) - 1)) : 0;
  const totalWithdraw = deposit + interest;

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name="永盛钱庄" zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#8a8a7a", marginBottom: 12, fontSize: 11 }}>
          银两 {money} 两 · 存款 {deposit} 两 · 利息 +{interest} 两（存入以来过了 {elapsed} 天，利率2%/天）
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 12, borderBottom: `1px solid ${zoneTheme.border}` }}>
          {[["deposit", "存款"], ["withdraw", "取款"]].map(([id, label]) => (
            <span key={id} onClick={() => setMode(id)}
              style={{ padding: "6px 14px", fontSize: 11, cursor: "pointer", userSelect: "none",
                color: mode === id ? zoneTheme.accent : zoneTheme.accentDim,
                borderBottom: mode === id ? `2px solid ${zoneTheme.accent}` : "2px solid transparent" }}
            >{label}</span>
          ))}
        </div>

        {mode === "deposit" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ color: "#c8bfa0", fontSize: 12 }}>存入：</span>
              <input type="number" value={amount} min={1} max={money}
                onChange={e => setAmount(Math.max(0, Math.min(Number(e.target.value), money)))}
                style={{ width: 80, background: "#10121a", border: `1px solid ${zoneTheme.border}`, borderRadius: 4, color: "#c8bfa0", fontSize: 12, padding: "3px 6px" }}
              />
              <span style={{ color: "#5a5a4a", fontSize: 11 }}>两</span>
            </div>
            <Btn label={`存入 ${amount} 两`} disabled={amount <= 0 || money < amount} zoneTheme={zoneTheme}
              onClick={() => onDeposit(amount)} />
          </>
        )}

        {mode === "withdraw" && (
          <div>
            <div style={{ color: "#c8bfa0", fontSize: 12, marginBottom: 10 }}>
              可取出：{totalWithdraw} 两（含利息 {interest} 两）
            </div>
            <Btn label={`取出全部（${totalWithdraw}两）`} disabled={deposit <= 0} zoneTheme={zoneTheme}
              onClick={() => onWithdraw(totalWithdraw)} />
          </div>
        )}
      </div>
    </Overlay>
  );
}
