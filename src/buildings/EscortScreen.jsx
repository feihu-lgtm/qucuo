import React from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

// 预定义的护镖任务列表
// targetNpc 必须在 npcPool 里有此 location 的高权重，保证玩家到了能找到他
export const ESCORT_QUESTS = [
  { id: "eq_zhangshang_yuquan", title: "布料押送", fromLocations: ["天都镇", "鱼定村"], targetNpc: "张商人", targetLocation: "玉泉寨", reward: 80, desc: "将一批布料押送到玉泉寨，交给正在那里等候的张商人。" },
  { id: "eq_lizhang_tiandu", title: "茶叶转运", fromLocations: ["锦官城", "鱼定村"], targetNpc: "李掌柜", targetLocation: "天都镇", reward: 60, desc: "把一箱上等茶叶送到天都镇，交给李掌柜的茶叶仓库管事。" },
  { id: "eq_zhusi_yiding", title: "商队随行", fromLocations: ["锦官城", "天都镇"], targetNpc: "大胡子朱四", targetLocation: "鱼定村", reward: 100, desc: "跟着大胡子朱四的商队走一段路到鱼定村，护送货物安全到达。" },
  { id: "eq_zhuoma_goncuo", title: "牧品运送", fromLocations: ["玉泉寨", "鱼定村"], targetNpc: "卓玛", targetLocation: "贡措海", reward: 50, desc: "帮卓玛把一批牛毛制品送到贡措海边，那里有人在等。" },
  { id: "eq_awang_tiandu", title: "骡马跑腿", fromLocations: ["鱼定村", "玉泉寨"], targetNpc: "赶马人阿旺", targetLocation: "天都镇", reward: 45, desc: "赶马人阿旺要去天都镇交货，路上帮着看住骡马，防止出意外。" },
];

export default function EscortScreen({ building, char, flags, questProgress, currentRoom, zoneTheme, onClose, inline, onAcceptEscort }) {
  const money = char.money || 0;

  // 过滤：只显示从当前据点出发的任务，且未接取也未完成的
  const available = ESCORT_QUESTS.filter(q => {
    if (q.fromLocations && !q.fromLocations.includes(currentRoom)) return false;
    if (flags.includes(`quest_done_${q.id}`)) return false;
    if (questProgress[q.id]?.active) return false;
    return true;
  });

  const active = ESCORT_QUESTS.filter(q => questProgress[q.id]?.active);

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#7a7a6a", fontSize: 11, marginBottom: 12 }}>
          {building.desc}
        </div>

        {active.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: "#d4a853", fontSize: 11, marginBottom: 6 }}>进行中的护镖任务：</div>
            {active.map(q => {
              const prog = questProgress[q.id];
              return (
                <div key={q.id} style={{ padding: "8px 10px", background: "#14120a", borderRadius: 4, border: "1px solid #4a3a1a", marginBottom: 6 }}>
                  <div style={{ color: "#e8c468", fontSize: 12 }}>{q.title}</div>
                  <div style={{ color: "#7a6a4a", fontSize: 11, marginTop: 3 }}>
                    目标：前往 {q.targetLocation}，找到 {q.targetNpc} 交货
                  </div>
                  <div style={{ color: "#4a8a4a", fontSize: 11, marginTop: 2 }}>
                    报酬：{q.reward} 两（完成后自动结算）
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ color: zoneTheme.accentDim, fontSize: 11, marginBottom: 8 }}>
          可接任务（{available.length}）：
        </div>

        {available.length === 0 && (
          <div style={{ color: "#5a5a4a", fontSize: 12 }}>
            {active.length > 0 ? "先完成手头的护镖任务吧。" : "暂无从本地出发的护镖任务。"}
          </div>
        )}

        {available.map(q => (
          <div key={q.id} style={{ marginBottom: 10, padding: "10px 12px", background: "#10121a", borderRadius: 6, border: `1px solid ${zoneTheme.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#c8bfa0", fontSize: 13 }}>{q.title}</span>
              <span style={{ color: "#4a8a4a", fontSize: 12 }}>报酬 {q.reward} 两</span>
            </div>
            <div style={{ color: "#7a7a6a", fontSize: 11, marginBottom: 4 }}>{q.desc}</div>
            <div style={{ color: "#6a8a6a", fontSize: 10, marginBottom: 8 }}>
              → 前往 {q.targetLocation} · 找 {q.targetNpc} 完成交货
            </div>
            <Btn label="接受任务" zoneTheme={zoneTheme} onClick={() => onAcceptEscort(q)} />
          </div>
        ))}
      </div>
    </Overlay>
  );
}
