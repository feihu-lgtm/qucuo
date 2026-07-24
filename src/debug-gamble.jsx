// GambleStoneScreen 组件调试入口（临时）：打开 /debug-gamble.html 直接渲染赌桌，
// 假 props 模拟"天都镇玉石料场·八位竞价者全员在场"，不必进游戏走流程。
// onTalk/onSettle 只打日志，方便肉眼验证卡牌围台布局与交互。
import React from "react";
import { createRoot } from "react-dom/client";
import GambleStoneScreen from "./buildings/GambleStoneScreen.jsx";

const mockNpcs = [
  { name: "李若由", gambleBidder: true, carry: [{ name: "紫檀小算盘", category: "misc", quality: "蓝" }] },
  { name: "锦官差役", gambleBidder: true, carry: [{ name: "巡捕营腰牌", category: "accessory", quality: "绿" }] },
  { name: "雪山弟子", gambleBidder: true, carry: [{ name: "雪山当归丸", category: "misc", quality: "蓝" }] },
  { name: "黑风寨采买", gambleBidder: true, carry: [{ name: "黑风令", category: "accessory", quality: "白" }] },
  { name: "才旦", gambleBidder: true, carry: [{ name: "鱼定酥油茶砖", category: "misc", quality: "绿" }] },
  { name: "苏宛", gambleBidder: true, carry: [{ name: "今年的春尖普洱", category: "misc", quality: "绿" }] },
  { name: "兰姐", carry: [{ name: "百花刺", category: "weapon", quality: "蓝" }] },
  { name: "温掌柜", carry: [{ name: "蜜蜡手串", category: "accessory", quality: "蓝" }] },
];

function Bench() {
  const [nego, setNego] = React.useState({});
  return (
    <GambleStoneScreen
      building={{ name: "赌石坊" }}
      char={{ name: "调试客", money: 5000, special: { 气运: 5, 悟性: 7 } }}
      time={10}
      zoneTheme={{}}
      roomNpcs={mockNpcs}
      negotiation={nego}
      onClose={() => console.log("[debug] onClose")}
      onTalk={(name, content, ctx) => {
        console.log("[debug] onTalk", name, content, ctx);
        // 模拟谈价谈成 +15%，写回 negotiation 验证"✓谈妥"回流显示
        setTimeout(() => setNego(prev => ({ ...prev, [ctx.stoneId]: { ...(prev[ctx.stoneId] || {}), [name]: Math.round(ctx.baseOffer * 1.15) } })), 600);
      }}
      onSettle={(res) => console.log("[debug] onSettle", res)}
      onInspect={async (stone, clue) => {
        console.log("[debug] onInspect", stone.id, clue);
        await new Promise(r => setTimeout(r, 800)); // 模拟 AI 延迟
        return `老师傅把石头翻了三翻，指腹在${clue.skinLabel}上碾了两碾：「${clue.skinClue}」${clue.mistHint ? `又眯眼凑近，「${clue.mistHint}。」` : ""}${clue.changKouHint ? `末了压低声，「依这皮色砂路，${clue.changKouHint}」` : "至于场口来历，他摇头不语。"}（debug mock）`;
      }}
    />
  );
}

createRoot(document.getElementById("gamble-root")).render(<Bench />);
