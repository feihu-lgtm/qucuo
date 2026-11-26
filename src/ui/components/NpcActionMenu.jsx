// NPC 互动菜单
// 点击"此地之人"里的NPC名字，不再直接触发look，而是先弹出四选一菜单：
// 切磋（战斗系统，本版占位——见下方注释）
// 偷窃（成功率与好感度线性正相关，本版占位）
// 对话（复用现有 talk 交互模式，立即可用）
// 送礼（依赖 take 系统，把背包物品送给NPC，立即可用）
//
// 切磋和偷窃这次先只做入口和提示，不做具体战斗/概率逻辑——
// 那两块涉及独立的数据结构（招式表、性格权重、回合状态机），
// 量级足够大，应该单独验证 UI 骨架没问题之后再往里填，
// 不然一次性塞进来出了问题不好定位是骨架错了还是逻辑错了。

import React, { useState } from "react";
import { QUCUO_SHOPS, hasOcShop } from "../../domain/data/shops/qucuoShops.js";
import ModalShell from "../primitives/ModalShell.jsx";

export default function NpcActionMenu({ npc, inv, onClose, onTalk, onGift, onDuel, onSteal, onLook, onLearnSkill, onTrade, onInviteCompanion, companionUnlocked, flags = [], ocRoutes = [], onOcRecruit, onRecallCompanion, onGoldenEgg, nemesisActive = false, lethalBlockReason = null }) {
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const isMerchant = !!QUCUO_SHOPS[npc.name] || hasOcShop(npc.name);
  // 伙伴候选（目前只有雪豹）：官方六件套之外单独一个"邀请入队"按钮，只在
  // 尚未解锁时出现——已经入队的伙伴角色不需要再邀请一次，六件套照常可用
  // （细看/切磋/送礼/拜师/偷窃仍然对已入队的雪豹开放，不因为入队而消失）。
  const canInvite = (!!npc.companionCandidate || !!npc.imported) && !companionUnlocked && (npc.name !== "雪豹" || flags.includes("snow_leopard_trusted"));

  const ACTIONS = [
    { key: "look", label: "细看", desc: "端详其人", available: true, onClick: () => { onLook(npc); onClose(); } },
    { key: "duel", label: "切磋", desc: "以武会友，点到为止", available: true, onClick: () => { onDuel(npc); onClose(); } },
    // WO-23C2d：生死战显式入口——只对 active 宿敌出现，文案明写「也决生死」。
    // WO-23C7：任务关键/过客宿敌入口禁用给 deterministic 原因，不隐藏无声——
    // available:false 时 onClick 置空，菜单只剩一句解释。
    ...(nemesisActive ? [{
      key: "lethalDuel", label: "生死战",
      desc: lethalBlockReason || "既分高下，也决生死",
      available: !lethalBlockReason,
      onClick: lethalBlockReason ? () => {} : () => { onDuel(npc, { lethal: true }); onClose(); },
    }] : []),
    { key: "steal", label: "偷窃", desc: "趁其不备，顺手牵羊", available: true, onClick: () => onSteal(npc) },
    { key: "talk", label: "对话", desc: "上前搭话", available: true, onClick: () => { onTalk(npc); onClose(); } },
    { key: "gift", label: "送礼", desc: "赠人以物，结个善缘", available: true, onClick: () => setShowGiftPicker(true) },
    { key: "learn", label: "拜师", desc: "求教一身本事", available: true, onClick: () => { onLearnSkill(npc); onClose(); } },
    ...(isMerchant ? [{ key: "trade", label: "交易", desc: "买卖货品", available: true, onClick: () => { onTrade(npc); onClose(); } }] : []),
    ...(canInvite ? [{ key: "invite", label: "邀请入队", desc: "结为同行的伙伴", available: true, onClick: () => { onInviteCompanion(npc); onClose(); } }] : []),
    // OC 冒险者四路招募（雇佣/凭交情/人情/青梅）——路线清单由 ocMenuRoutes 按条件给出
    ...ocRoutes.map((r) => ({
      key: `oc_${r.route}`, label: r.label, desc: r.desc, available: true,
      onClick: () => { onOcRecruit?.(npc, r.route); onClose(); },
    })),
    // 元朵朵专属：金鸟金蛋每日签到（每自然日一颗，当天已领会提示金鸟只来一趟）
    ...(npc.name === "元朵朵" ? [{ key: "goldenEgg", label: "金鸟金蛋", desc: "每日一颗，讨个彩头", available: true, onClick: () => { onGoldenEgg?.(npc); onClose(); } }] : []),
    // 留守队友在该房间可被唤回
    ...(npc.stationed && npc.companion ? [{ key: "recall", label: "跟上我", desc: "唤回身边，结伴同行", available: true, onClick: () => { onRecallCompanion?.(npc); onClose(); } }] : []),
  ];

  if (showGiftPicker) {
    return (
      <GiftPicker
        npc={npc}
        inv={inv}
        onBack={() => setShowGiftPicker(false)}
        onConfirm={(item) => { onGift(npc, item); onClose(); }}
      />
    );
  }

  return (
    <ModalShell onClose={onClose} layer="dialog" backdrop="soft" mobile="sheet" showClose={false} ariaLabel={`与${npc.name}互动`} panelStyle={{ width: 320 }}>
      <div style={{ color: "var(--accent)", fontSize: "var(--fs-base)", marginBottom: 4 }}>{npc.name}{npc.intimate ? " ♥" : ""}</div>
      <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", marginBottom: 16 }}>{npc.brief}</div>

      <div className="mobile-action-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {ACTIONS.map((a) => (
          <div
            key={a.key}
            className="mobile-action-choice"
            onClick={a.onClick}
            style={{
              cursor: "pointer", padding: "12px 10px", borderRadius: 0, textAlign: "center",
              background: "var(--bg)", border: `1px solid var(--border)`,
              opacity: a.available ? 1 : 0.4,
            }}
          >
            <div style={{ color: "var(--accent)", fontSize: "var(--fs-md)", marginBottom: 3 }}>{a.label}</div>
            <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-2xs)" }}>{a.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 14 }}>
        <span className="mobile-touch-target" onClick={onClose} style={{ cursor: "pointer", color: "var(--text-dim)", fontSize: "var(--fs-xs)" }}>取消</span>
      </div>
    </ModalShell>
  );
}

// 送礼的物品选择子面板：从背包里挑一件送出去
function GiftPicker({ npc, inv, onBack, onConfirm }) {
  // 点遮罩、按 Esc 都是"返回上一层"，与原先点遮罩回到主菜单一致。
  return (
    <ModalShell onClose={onBack} layer="dialog" backdrop="soft" mobile="sheet" showClose={false} ariaLabel={`送给${npc.name}的物品`} panelStyle={{ width: 320, maxHeight: "70vh" }}>
      <div style={{ color: "var(--accent)", fontSize: "var(--fs-md)", marginBottom: 12 }}>送给「{npc.name}」什么？</div>
      <GiftPickerList onPick={onConfirm} inv={inv} />
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <span onClick={onBack} style={{ cursor: "pointer", color: "var(--text-dim)", fontSize: "var(--fs-xs)" }}>← 返回</span>
      </div>
    </ModalShell>
  );
}

// inv 由父组件通过 context 或 prop 传入；这里用一个占位列表渲染器，
// 真正的背包数据在 MudRPG.jsx 里通过 props 往下传（见接入说明）
function GiftPickerList({ onPick, inv }) {
  const list = inv || [];
  if (list.length === 0) {
    return <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-sm)" }}>包袱空空，没什么拿得出手的东西</div>;
  }
  return (
    <div className="mobile-action-grid mobile-action-list" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {list.map((it, i) => {
        const isObj = typeof it === "object";
        const name = isObj ? it.name : it;
        return (
          <div
            key={isObj ? it.id : i}
            className="mobile-action-choice"
            onClick={() => onPick(it)}
            style={{ cursor: "pointer", padding: "6px 8px", borderRadius: 0, color: "var(--text)", fontSize: "var(--fs-sm)", background: "var(--bg)" }}
          >
            {name}{isObj ? ` (${it.quality})` : ""}
          </div>
        );
      })}
    </div>
  );
}
