import React, { useState } from "react";
import { Overlay, Header, Btn } from "./common.jsx";
import { withdrawalSummary } from "../../../features/bank/logic.js";

// 钱庄：存取银两，每24时间单位生息2%
export default function BankScreen({ building, char, time, deposit, depositedAt, onClose, inline, onDeposit, onWithdraw }) {
  const [amount, setAmount] = useState(0);
  const [mode, setMode] = useState("deposit");
  const money = char.money || 0;

  const { elapsed, interest, total: totalWithdraw } = withdrawalSummary({ time, deposit, depositedAt });

  return (
    <Overlay onClose={onClose} inline={inline}>
      <Header name="永盛钱庄" onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "var(--ink-text-dim)", marginBottom: 12, fontSize: "var(--fs-xs)" }}>
          银两 {money} 两 · 存款 {deposit} 两 · 利息 +{interest} 两（存入以来过了 {elapsed} 天，利率2%/天）
        </div>

        <div style={{ display: "flex", gap: 0, marginBottom: 12, borderBottom: `1px solid var(--border)` }}>
          {[["deposit", "存款"], ["withdraw", "取款"]].map(([id, label]) => (
            <span key={id} onClick={() => setMode(id)}
              style={{ padding: "6px 14px", fontSize: "var(--fs-xs)", cursor: "pointer", userSelect: "none",
                color: mode === id ? "var(--accent)" : "var(--accent-dim)",
                borderBottom: mode === id ? `2px solid var(--accent)` : "2px solid transparent" }}
            >{label}</span>
          ))}
        </div>

        {mode === "deposit" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ color: "var(--ink-text)", fontSize: "var(--fs-sm)" }}>存入：</span>
              <input type="number" value={amount} min={1} max={money}
                onChange={e => setAmount(Math.max(0, Math.min(Number(e.target.value), money)))}
                style={{ width: 80, background: "var(--bg-ink)", border: `1px solid var(--border)`, borderRadius: 0, color: "var(--ink-text)", fontSize: "var(--fs-sm)", padding: "3px 6px" }}
              />
              <span style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-xs)" }}>两</span>
            </div>
            <Btn label={`存入 ${amount} 两`} disabled={amount <= 0 || money < amount}
              onClick={() => onDeposit(amount)} />
          </>
        )}

        {mode === "withdraw" && (
          <div>
            <div style={{ color: "var(--ink-text)", fontSize: "var(--fs-sm)", marginBottom: 10 }}>
              可取出：{totalWithdraw} 两（含利息 {interest} 两）
            </div>
            <Btn label={`取出全部（${totalWithdraw}两）`} disabled={deposit <= 0}
              onClick={() => onWithdraw()} />
          </div>
        )}
      </div>
    </Overlay>
  );
}
