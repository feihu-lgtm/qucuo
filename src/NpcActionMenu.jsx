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
import { QUCUO_SHOPS } from "./shops/qucuoShops.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";

export default function NpcActionMenu({ npc, zoneTheme, inv, onClose, onTalk, onGift, onDuel, onSteal, onLook, onLearnSkill, onTrade, onInviteCompanion, companionUnlocked }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const isMerchant = !!QUCUO_SHOPS[npc.name];
  // 伙伴候选（目前只有雪豹）：官方六件套之外单独一个"邀请入队"按钮，只在
  // 尚未解锁时出现——已经入队的伙伴角色不需要再邀请一次，六件套照常可用
  // （细看/切磋/送礼/拜师/偷窃仍然对已入队的雪豹开放，不因为入队而消失）。
  const canInvite = (!!npc.companionCandidate || !!npc.imported) && !companionUnlocked;

  const ACTIONS = [
    { key: "look", label: "细看", desc: "端详其人", available: true, onClick: () => { onLook(npc); onClose(); } },
    { key: "duel", label: "切磋", desc: "以武会友，点到为止", available: true, onClick: () => { onDuel(npc); onClose(); } },
    { key: "steal", label: "偷窃", desc: "趁其不备，顺手牵羊", available: true, onClick: () => onSteal(npc) },
    { key: "talk", label: "对话", desc: "上前搭话", available: true, onClick: () => { onTalk(npc); onClose(); } },
    { key: "gift", label: "送礼", desc: "赠人以物，结个善缘", available: true, onClick: () => setShowGiftPicker(true) },
    { key: "learn", label: "拜师", desc: "求教一身本事", available: true, onClick: () => { onLearnSkill(npc); onClose(); } },
    ...(isMerchant ? [{ key: "trade", label: "交易", desc: "买卖货品", available: true, onClick: () => { onTrade(npc); onClose(); } }] : []),
    ...(canInvite ? [{ key: "invite", label: "邀请入队", desc: "结为同行的伙伴", available: true, onClick: () => { onInviteCompanion(npc); onClose(); } }] : []),
  ];

  if (showGiftPicker) {
    return (
      <GiftPicker
        npc={npc}
        zoneTheme={zoneTheme}
        inv={inv}
        onBack={() => setShowGiftPicker(false)}
        onConfirm={(item) => { onGift(npc, item); onClose(); }}
      />
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.75)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div
        style={{ background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`, borderRadius: 6, padding: 20, width: 320, maxWidth: "90vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ color: zoneTheme.accent, fontSize: "14px", marginBottom: 4 }}>{npc.name}</div>
        <div style={{ color: zoneTheme.textDim, fontSize: "11px", marginBottom: 16 }}>{npc.brief}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {ACTIONS.map((a) => (
            <div
              key={a.key}
              onClick={a.onClick}
              style={{
                cursor: "pointer", padding: "12px 10px", borderRadius: 4, textAlign: "center",
                background: zoneTheme.bg, border: `1px solid ${zoneTheme.border}`,
                opacity: a.available ? 1 : 0.4,
              }}
            >
              <div style={{ color: zoneTheme.accent, fontSize: "13px", marginBottom: 3 }}>{a.label}</div>
              <div style={{ color: zoneTheme.textDim, fontSize: "10px" }}>{a.desc}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 14 }}>
          <span onClick={onClose} style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: "11px" }}>取消</span>
        </div>
      </div>
    </div>
  );
}

// 送礼的物品选择子面板：从背包里挑一件送出去
function GiftPicker({ npc, zoneTheme, inv, onBack, onConfirm }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(4,4,10,0.75)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onBack}>
      <div
        style={{ background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`, borderRadius: 6, padding: 20, width: 320, maxWidth: "90vw", maxHeight: "70vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ color: zoneTheme.accent, fontSize: "13px", marginBottom: 12 }}>送给「{npc.name}」什么？</div>
        <GiftPickerList zoneTheme={zoneTheme} onPick={onConfirm} inv={inv} />
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <span onClick={onBack} style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: "11px" }}>← 返回</span>
        </div>
      </div>
    </div>
  );
}

// inv 由父组件通过 context 或 prop 传入；这里用一个占位列表渲染器，
// 真正的背包数据在 MudRPG.jsx 里通过 props 往下传（见接入说明）
function GiftPickerList({ zoneTheme, onPick, inv }) {
  const list = inv || [];
  if (list.length === 0) {
    return <div style={{ color: zoneTheme.textDim, fontSize: "12px" }}>包袱空空，没什么拿得出手的东西</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {list.map((it, i) => {
        const isObj = typeof it === "object";
        const name = isObj ? it.name : it;
        return (
          <div
            key={isObj ? it.id : i}
            onClick={() => onPick(it)}
            style={{ cursor: "pointer", padding: "6px 8px", borderRadius: 3, color: zoneTheme.text, fontSize: "12px", background: zoneTheme.bg }}
          >
            {name}{isObj ? ` (${it.quality})` : ""}
          </div>
        );
      })}
    </div>
  );
}
