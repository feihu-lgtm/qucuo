import React, { useState, useEffect } from "react";
import { useOverlayCloseGuard } from "../utils/overlayClose.js";
import {
  getHomestead, loadWineCellar, saveWineCellar,
  loadGarden, saveGarden, RECIPES, WINE_RECIPES, PLANT_SLOTS,
} from "../homestead.js";

const btnStyle = {
  cursor: "pointer", color: "#c8323a", padding: "5px 12px", background: "#161510",
  border: "1px solid #4a453c", borderRadius: 0, fontSize: "11.5px", display: "inline-block",
};
const dimBtn = { ...btnStyle, color: "#8f8a7c", borderColor: "#1a1a2a" };

export default function HomesteadPanel({ roomName, inv, setInv, char, setChar, zoneTheme, onClose, addLog }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  const home = getHomestead(roomName);
  const [activeFeature, setActiveFeature] = useState(null);

  if (!home) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 210, background: "rgba(4,4,10,0.92)", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={{ background: "#111110", border: "1px solid #4a453c", borderRadius: 0, padding: 20, width: 520, maxWidth: "92vw", maxHeight: "85vh", overflowY: "auto", color: "#e8e4d6", fontSize: "12.5px" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ color: "#c8323a", fontSize: "14px" }}>
            {activeFeature ? (
              <span style={{ cursor: "pointer" }} onClick={() => setActiveFeature(null)}>← 返回 · {home.label}</span>
            ) : `🏠 ${home.label}`}
          </span>
          <span style={{ color: "#8f8a7c", fontSize: "11px", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
        </div>

        {!activeFeature && (
          <>
            <div style={{ fontSize: "11px", color: "#8f8a7c", marginBottom: 12, lineHeight: 1.6, fontStyle: "italic" }}>{home.flavor}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {home.features.map(f => (
                <div key={f.id} onClick={() => setActiveFeature(f.id)}
                  style={{ cursor: "pointer", padding: "12px 10px", borderRadius: 0, background: "#161510", border: "1px solid #4a453c", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8323a"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#4a453c"; }}
                >
                  <div style={{ fontSize: "14px", marginBottom: 4 }}>{f.icon} <span style={{ color: "#c8e0d8", fontSize: "12px" }}>{f.name}</span></div>
                  <div style={{ fontSize: "10px", color: "#8f8a7c", lineHeight: 1.4 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeFeature === "cooking" && <CookingFeature inv={inv} setInv={setInv} char={char} setChar={setChar} addLog={addLog} />}
        {activeFeature === "wine" && <WineFeature roomName={roomName} inv={inv} setInv={setInv} addLog={addLog} />}
        {activeFeature === "garden" && <GardenFeature roomName={roomName} inv={inv} setInv={setInv} addLog={addLog} />}
        {activeFeature === "pigeon" && <PigeonFeature addLog={addLog} />}
        {activeFeature === "fireplace" && <RestFeature label="壁炉" desc="生起火来，松木噼啪响。暖意从脚底漫上来。" hpRestore={20} char={char} setChar={setChar} addLog={addLog} />}
        {activeFeature === "telescope" && <TelescopeFeature addLog={addLog} />}
        {activeFeature === "training" && <RestFeature label="练功场" desc="对着木桩打了一套拳，指节磕得生疼，但筋骨松开了。" hpRestore={10} char={char} setChar={setChar} addLog={addLog} />}
        {activeFeature === "study" && <RestFeature label="书房" desc="翻了几页杂书，读到一句有意思的，抄在掌心。" hpRestore={5} char={char} setChar={setChar} addLog={addLog} />}
        {activeFeature === "guqin" && <RestFeature label="琴桌" desc="拨了两下断弦，嗡的一声，猫都跑了。" hpRestore={5} char={char} setChar={setChar} addLog={addLog} />}
        {activeFeature === "meditation" && <RestFeature label="佛堂" desc="在蒲团上坐了一炷香。香灰落下来，心也落下来。" hpRestore={30} char={char} setChar={setChar} addLog={addLog} />}
        {activeFeature === "library" && <RestFeature label="书房" desc="地方志里翻到一段前朝旧事，蜀王庄原来是这么来的。" hpRestore={10} char={char} setChar={setChar} addLog={addLog} />}
      </div>
    </div>
  );
}

function CookingFeature({ inv, setInv, char, setChar, addLog }) {
  const invNames = inv.map(it => typeof it === "string" ? it : it?.name);
  const canCook = (r) => r.ingredients.every(ing => invNames.includes(ing));

  const cook = (recipe) => {
    const nextInv = [...inv];
    for (const ing of recipe.ingredients) {
      const idx = nextInv.findIndex(it => (typeof it === "string" ? it : it?.name) === ing);
      if (idx >= 0) nextInv.splice(idx, 1);
    }
    nextInv.push({ name: recipe.result, category: "misc", quality: "绿", desc: `烹饪所得。${recipe.buff}，持续${recipe.duration}回合。` });
    setInv(nextInv);
    addLog?.({ text: `【烹饪】你生火做饭，炮制出一份「${recipe.result}」。${recipe.buff}。`, type: "system" });
  };

  return (
    <div>
      <div style={{ fontSize: "11px", color: "#8f8a7c", marginBottom: 10 }}>灶膛里还有余烬。有食材就能开火。</div>
      {RECIPES.map(r => {
        const ok = canCook(r);
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #14161e", opacity: ok ? 1 : 0.4 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", color: ok ? "#c8e0d8" : "#8f8a7c" }}>{r.result}</div>
              <div style={{ fontSize: "10px", color: "#8f8a7c" }}>需：{r.ingredients.join(" + ")} → {r.buff}（{r.duration}回合）</div>
            </div>
            <span onClick={ok ? () => cook(r) : undefined} style={ok ? btnStyle : dimBtn}>烹饪</span>
          </div>
        );
      })}
    </div>
  );
}

function WineFeature({ roomName, inv, setInv, addLog }) {
  const [cellar, setCellar] = useState(() => loadWineCellar(roomName));
  const invNames = inv.map(it => typeof it === "string" ? it : it?.name);
  const now = Date.now();

  const persist = (items) => { setCellar(items); saveWineCellar(roomName, items); };

  const brew = (recipe) => {
    const ok = recipe.ingredients.every(ing => invNames.includes(ing));
    if (!ok) return;
    const nextInv = [...inv];
    for (const ing of recipe.ingredients) {
      const idx = nextInv.findIndex(it => (typeof it === "string" ? it : it?.name) === ing);
      if (idx >= 0) nextInv.splice(idx, 1);
    }
    setInv(nextInv);
    persist([...cellar, { recipe: recipe.id, result: recipe.result, buff: recipe.buff, note: recipe.note, readyAt: now + recipe.ageTime * 60000 }]);
    addLog?.({ text: `【酿酒】你把${recipe.ingredients.join("、")}封进坛子，搁在窖里。${recipe.ageTime}分钟后可取。`, type: "system" });
  };

  const collect = (idx) => {
    const item = cellar[idx];
    if (!item || item.readyAt > now) return;
    const next = [...cellar]; next.splice(idx, 1);
    persist(next);
    setInv([...inv, { name: item.result, category: "misc", quality: "蓝", desc: `${item.note} ${item.buff}` }]);
    addLog?.({ text: `【酒窖】你起开泥封，「${item.result}」成了。${item.note}`, type: "system" });
  };

  return (
    <div>
      <div style={{ fontSize: "11px", color: "#8f8a7c", marginBottom: 10 }}>石窖阴凉，坛子沿上长着青苔。酿好的酒存这里不会坏。</div>
      {cellar.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: "11px", color: "#8ac8b8", marginBottom: 6 }}>窖藏中（{cellar.length}）</div>
          {cellar.map((c, i) => {
            const ready = c.readyAt <= now;
            const remain = Math.max(0, Math.ceil((c.readyAt - now) / 60000));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #14161e" }}>
                <span style={{ flex: 1, fontSize: "11.5px", color: ready ? "#c8e0d8" : "#8f8a7c" }}>
                  🍶 {c.result} {ready ? "· 已成" : `· 还需${remain}分钟`}
                </span>
                <span onClick={ready ? () => collect(i) : undefined} style={ready ? btnStyle : dimBtn}>{ready ? "取酒" : "等待"}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: "11px", color: "#8ac8b8", marginBottom: 6 }}>酒方</div>
      {WINE_RECIPES.map(r => {
        const ok = r.ingredients.every(ing => invNames.includes(ing));
        return (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #14161e", opacity: ok ? 1 : 0.4 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", color: ok ? "#c8e0d8" : "#8f8a7c" }}>{r.result}</div>
              <div style={{ fontSize: "10px", color: "#8f8a7c" }}>需：{r.ingredients.join(" + ")} · 窖藏{r.ageTime}分钟 → {r.buff}</div>
            </div>
            <span onClick={ok ? () => brew(r) : undefined} style={ok ? btnStyle : dimBtn}>封坛</span>
          </div>
        );
      })}
    </div>
  );
}

function GardenFeature({ roomName, inv, setInv, addLog }) {
  const [garden, setGarden] = useState(() => loadGarden(roomName));
  const now = Date.now();
  const persist = (items) => { setGarden(items); saveGarden(roomName, items); };

  const plant = (slot) => {
    if (garden.length >= 3) return;
    if (garden.some(g => g.id === slot.id)) return;
    persist([...garden, { id: slot.id, yield: slot.yield, readyAt: now + slot.growTime * 60000 }]);
    addLog?.({ text: `【菜畦】你翻土下种，${slot.note}`, type: "system" });
  };

  const harvest = (idx) => {
    const g = garden[idx];
    if (!g || g.readyAt > now) return;
    const next = [...garden]; next.splice(idx, 1);
    persist(next);
    setInv([...inv, { name: g.yield, category: "misc", quality: "白", desc: "自家菜畦种的。" }]);
    addLog?.({ text: `【菜畦】你拔出一把「${g.yield}」，带着泥，新鲜。`, type: "system" });
  };

  return (
    <div>
      <div style={{ fontSize: "11px", color: "#8f8a7c", marginBottom: 10 }}>巴掌大的地，最多同时种三样。按分钟计（加速生长，别太较真）。</div>
      {garden.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: "11px", color: "#8ac8b8", marginBottom: 6 }}>地里（{garden.length}/3）</div>
          {garden.map((g, i) => {
            const ready = g.readyAt <= now;
            const remain = Math.max(0, Math.ceil((g.readyAt - now) / 60000));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #14161e" }}>
                <span style={{ flex: 1, fontSize: "11.5px", color: ready ? "#c8e0d8" : "#8f8a7c" }}>
                  🌱 {g.yield} {ready ? "· 熟了" : `· 还需${remain}分钟`}
                </span>
                <span onClick={ready ? () => harvest(i) : undefined} style={ready ? btnStyle : dimBtn}>{ready ? "收" : "等"}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: "11px", color: "#8ac8b8", marginBottom: 6 }}>可种</div>
      {PLANT_SLOTS.map(s => {
        const planted = garden.some(g => g.id === s.id);
        const full = garden.length >= 3;
        const ok = !planted && !full;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid #14161e", opacity: ok ? 1 : 0.4 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "12px", color: ok ? "#c8e0d8" : "#8f8a7c" }}>{s.yield}</div>
              <div style={{ fontSize: "10px", color: "#8f8a7c" }}>{s.growTime}分钟熟 · {s.note}</div>
            </div>
            <span onClick={ok ? () => plant(s) : undefined} style={ok ? btnStyle : dimBtn}>{planted ? "已种" : "种"}</span>
          </div>
        );
      })}
    </div>
  );
}

function PigeonFeature({ addLog }) {
  const [sent, setSent] = useState(false);
  return (
    <div>
      <div style={{ fontSize: "11px", color: "#8f8a7c", marginBottom: 10, lineHeight: 1.6 }}>
        竹编鸽笼里两只灰鸽，一只歪着头看你，另一只在啄自己的脚。
        笼门上刻着一行小字：「急事才放，鸽子也累。」
      </div>
      {!sent ? (
        <span onClick={() => { setSent(true); addLog?.({ text: "【鸽子笼】你解下一只灰鸽，脚环上拴了纸条，往天上一抛。鸽子扑棱棱飞远了。", type: "system" }); }} style={btnStyle}>
          🕊 放飞信鸽
        </span>
      ) : (
        <div style={{ color: "#5a8a5a", fontSize: "11.5px" }}>鸽子飞走了。笼里剩一只，咕咕叫着，不太高兴。</div>
      )}
    </div>
  );
}

function TelescopeFeature({ addLog }) {
  const [looked, setLooked] = useState(false);
  const sights = [
    "山谷里起了雾，什么都看不见。",
    "远处官道上有一队马帮，驮着货往锦官城方向走。",
    "后山温泉那边冒着白气，隐约有人影。",
    "天边一只鹰，盘旋了很久，往雪山方向去了。",
  ];
  return (
    <div>
      <div style={{ fontSize: "11px", color: "#8f8a7c", marginBottom: 10, lineHeight: 1.6 }}>
        铜制望远镜架在窗台上，镜片擦得还算干净。正对山谷，视野极好。
      </div>
      {!looked ? (
        <span onClick={() => { setLooked(true); addLog?.({ text: `【望远镜】你凑上去看了一眼——${sights[Math.floor(Math.random() * sights.length)]}`, type: "system" }); }} style={btnStyle}>
          🔭 远眺
        </span>
      ) : (
        <div style={{ color: "#5a8a5a", fontSize: "11.5px" }}>看过了。风景不变，人变了。</div>
      )}
    </div>
  );
}

function RestFeature({ label, desc, hpRestore, char, setChar, addLog }) {
  const [done, setDone] = useState(false);
  const hp = char.hp[0];
  const maxHp = char.hp[1];

  const doRest = () => {
    const newHp = Math.min(maxHp, hp + hpRestore);
    setChar(c => ({ ...c, hp: [newHp, c.hp[1]] }));
    setDone(true);
    addLog?.({ text: `【${label}】${desc} 气血恢复 ${newHp - hp} 点。`, type: "system" });
  };

  return (
    <div>
      <div style={{ fontSize: "11px", color: "#8f8a7c", marginBottom: 10, lineHeight: 1.6 }}>{desc}</div>
      <div style={{ fontSize: "11px", color: "#8f8a7c", marginBottom: 10 }}>气血 {hp}/{maxHp} · 可恢复 {Math.min(hpRestore, maxHp - hp)} 点</div>
      {!done ? (
        <span onClick={doRest} style={hp >= maxHp ? dimBtn : btnStyle}>{hp >= maxHp ? "气血已满" : `歇一歇（+${Math.min(hpRestore, maxHp - hp)}）`}</span>
      ) : (
        <div style={{ color: "#5a8a5a", fontSize: "11.5px" }}>歇过了。精神头好了些。</div>
      )}
    </div>
  );
}
