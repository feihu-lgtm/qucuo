import React, { useState } from "react";
import { CATEGORY_LABEL } from "../../domain/rules/economy/equipment.js";
import { effectBrief, passiveBonusBrief } from "../../domain/rules/economy/itemEffectText.js";
import { QUALITY_COLOR } from "../../domain/data/items/qualityColor.js";

// WO-14 水墨竹简「天机落账卡」：日志项携带 receipts 时，在正文下方渲染的紧凑
// 落账条。对照 WO-11 materializeFacts 的真实 receipt 形状：
//   { kind:"grant_item",   factId, item }
//   { kind:"reforge_item", factId, item }
//   { kind:"bestow_skill", factId, skill }
// （pact 类回执属后续工单，「阅契」按钮预留同一条透传通路。）
//
// 回调纪律（手册锁死）：按钮只组装 action 对象经 onAction 透传给
// NarrativeLogFeed 的 act，组件内严禁直调 gameStore；按钮单次可点——
// 点过即灰，落账既成事实，不重复派发。
//
// 样式纪律：字号一律走 tokens 的 fs 阶梯变量，颜色一律走令牌变量
// （QUALITY_COLOR 本身即令牌变量），不写裸 px 字号与 #hex。

const KIND_TITLE = {
  grant_item: "天工賜物",
  reforge_item: "兵刃重鑄",
  bestow_skill: "傳功頓悟",
  pact: "江湖契約",
};

function provenanceLine(prov) {
  if (!prov || typeof prov !== "object") return "";
  const bits = [];
  if (Number.isFinite(prov.day)) bits.push(`第${prov.day}日`);
  if (prov.place) bits.push(prov.place);
  if (prov.fromNpc) bits.push(`得自${prov.fromNpc}`);
  return bits.join(" · ");
}

function itemStatLine(item) {
  const bits = [];
  if (item.atk != null) bits.push(`攻 ${item.atk}`);
  if (item.def != null) bits.push(`防 ${item.def}`);
  return bits.join(" ");
}

// 一条回执该配哪些操作钮：按物品种类/回执种类定，不臆造消费端不存在的操作。
function buttonsFor(receipt) {
  const out = [];
  if (receipt.kind === "grant_item" || receipt.kind === "reforge_item") {
    const cat = receipt.item?.category;
    if (cat === "weapon" || cat === "armor" || cat === "accessory") {
      out.push({ op: "equip", label: "佩挂" });
    }
    if (receipt.item?.consumable) out.push({ op: "consume", label: "服用" });
  } else if (receipt.kind === "bestow_skill") {
    if ((receipt.skill?.type || "") === "招式" || receipt.skill?.moveType) {
      out.push({ op: "activate", label: "设为主招" });
    }
  } else if (receipt.kind === "pact") {
    out.push({ op: "viewPact", label: "阅契" });
  }
  return out;
}

// 结构化 action 构造器（导出供链路测试钉字段）：id/factId/op/kind 全携带，
// 下游按 id 寻址，不再依赖名字翻文本。
export function buildReceiptAction(receipt, op, payload, isSkill) {
  return {
    type: "effectReceipt",
    op,
    kind: receipt.kind,
    factId: receipt.factId || "",
    itemId: !isSkill ? payload.id : undefined,
    skillId: isSkill ? payload.id : undefined,
    name: payload.name || "",
  };
}

export default function EffectReceiptCard({ receipt, onAction }) {
  const [usedOps, setUsedOps] = useState(() => new Set());
  if (!receipt || typeof receipt !== "object") return null;

  const isSkill = receipt.kind === "bestow_skill";
  const payload = isSkill ? receipt.skill : receipt.item;
  if (!payload || typeof payload !== "object") return null;

  const quality = payload.quality || "白";
  const qc = QUALITY_COLOR[quality] || "var(--text)";
  const title = KIND_TITLE[receipt.kind] || "天機落賬";
  const prov = provenanceLine(payload.provenance);

  // 词条翻译：物品走 effectBrief(effect, sixDim)；武学招式走 moveType/品阶，
  // 内功轻功走 passiveBonusBrief——全复用 itemEffectText 唯一词典，不另起炉灶。
  let briefLine = "";
  if (isSkill) {
    briefLine = passiveBonusBrief(payload.passiveBonus) || payload.moveType || "";
  } else {
    briefLine = effectBrief(payload.effect, payload.sixDim) || "";
  }
  const statLine = isSkill ? "" : itemStatLine(payload);
  const buttons = buttonsFor(receipt);

  const fire = (op) => {
    if (usedOps.has(op) || typeof onAction !== "function") return;
    setUsedOps((prev) => new Set([...prev, op]));
    onAction(buildReceiptAction(receipt, op, payload, isSkill));
  };

  return (
    <div
      className="effect-receipt-card"
      style={{
        maxWidth: 420,
        margin: "8px auto",
        padding: "7px 12px 7px 14px",
        borderLeft: `3px solid ${qc}`,
        background: "linear-gradient(90deg, rgba(0,0,0,0.28), rgba(0,0,0,0.10))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        fontSize: "var(--fs-sm)",
        lineHeight: 1.7,
        letterSpacing: "0.04em",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--fs-2xs)", letterSpacing: "0.18em", opacity: 0.72 }}>{title}</span>
        <span style={{ fontSize: "var(--fs-md)", fontWeight: 700, color: qc }}>{payload.name || "无名"}</span>
        <span style={{ fontSize: "var(--fs-2xs)", color: qc, border: `1px solid ${qc}`, padding: "0 6px", borderRadius: 2 }}>
          {quality}
        </span>
        {!isSkill && (
          <span style={{ fontSize: "var(--fs-2xs)", opacity: 0.65 }}>
            {CATEGORY_LABEL[payload.category] || "杂物"}
          </span>
        )}
      </div>
      {(statLine || briefLine) && (
        <div style={{ marginTop: 3, fontSize: "var(--fs-xs)", opacity: 0.88 }}>
          {statLine && <span style={{ marginRight: 10 }}>{statLine}</span>}
          {briefLine}
        </div>
      )}
      {prov && (
        <div style={{ marginTop: 2, fontSize: "var(--fs-2xs)", opacity: 0.55, fontStyle: "italic" }}>
          {prov}
        </div>
      )}
      {buttons.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
          {buttons.map((b) => {
            const used = usedOps.has(b.op);
            return (
              <button
                key={b.op}
                type="button"
                disabled={used}
                onClick={() => fire(b.op)} className="receipt-action-btn" data-on={Boolean(used)} style={{ color: used ? "var(--text)" : qc, border: `1px solid ${qc}` }}
              >
                {used ? `${b.label}✓` : b.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
