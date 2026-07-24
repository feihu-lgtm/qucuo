// ItemActionMenu 调试入口（临时）：验证"包袱里点装备能否直接穿戴"。
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import ItemActionMenu from "./ItemActionMenu.jsx";
import { makeItem, ITEM_CATEGORY, toggleEquip } from "./equipment.js";
import { makeItemSmart } from "./items/catalog.js";
const makeGameItem = (s) => makeItemSmart(s, makeItem);

const theme = { bg: "#1a1710", bgPanel: "#221e16", border: "#4a443a", accent: "#f0d090", accentDim: "#a08a5a", textDim: "#7a7060" };

function Bench() {
  const [inv, setInv] = useState(() => [
    makeGameItem({ name: "霜蚕宝甲", category: "armor", quality: "紫", desc: "霜蚕丝鞣制" }),
    makeGameItem({ name: "鱼定枪", category: "weapon", quality: "白", desc: "" }),
    makeGameItem({ name: "半袋青稞", category: "misc", quality: "白", desc: "" }),
  ]);
  const [open, setOpen] = useState(null);
  return (
    <div style={{ padding: 24, color: "#c9bfa8", fontFamily: "serif" }}>
      <div style={{ marginBottom: 12, color: theme.accent }}>包袱（点物品打开菜单）</div>
      {inv.map((it) => (
        <div key={it.id} onClick={() => setOpen(it)}
          style={{ cursor: "pointer", padding: "6px 0", borderBottom: "1px solid #2a2620" }}>
          · {it.name} ({it.quality}){it.equipped ? " [已装备]" : ""}
          <span style={{ float: "right", color: theme.accentDim, fontSize: 11 }}>
            {["weapon","armor","accessory"].includes(it.category) ? (it.equipped ? "⊙卸" : "⊙穿") : ""}
          </span>
        </div>
      ))}
      <div style={{ marginTop: 16, fontSize: 12, color: theme.textDim }}>
        当前已装备：{inv.filter(i => i.equipped).map(i => i.name).join("、") || "无"}
      </div>
      {open && (
        <ItemActionMenu item={inv.find(i => i.id === open.id)} mode="inventory" roomNpcs={[]} zoneTheme={theme}
          canConsume={false} onClose={() => setOpen(null)}
          onInspect={() => console.log("inspect")} onConsume={() => {}} onGive={() => {}} onSell={() => {}} onCollect={() => {}}
          onEquip={(it) => setInv(v => toggleEquip(v, it.id))} />
      )}
    </div>
  );
}
createRoot(document.getElementById("item-root")).render(<Bench />);
