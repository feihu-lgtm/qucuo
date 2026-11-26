// A4 模板化采样序列：回合输入不再预写死，而是按模板+在场实况填充。
// 每回合驱动器先读 buildPresence 同口径的可见名单（NPC/背包/出口/地上物），
// 填进模板槽位；槽位缺料就换下一条模板并记录跳过原因。
// 纯函数无依赖，node 与浏览器通用。

// 槽位：{npc}=在场人物 {npc2}=另一位在场人物 {item}=背包物件 {food}=背包耗材
// {weapon}=背包兵刃 {direction}=可用出口(n/s/e/w 的中文) {ground}=地上物
export const TEMPLATES = [
  // ---- talk ×12（配额外溢 2 抵消 skip/误分类）----
  { id: "talk_news", kind: "talk", target: 4, needs: ["npc"], text: "跟{npc}打听一下，最近村里可有什么新鲜事" },
  { id: "talk_way", kind: "talk", target: 4, needs: ["npc"], text: "请问{npc}，此去天都镇该往哪个方向走" },
  { id: "talk_casual", kind: "talk", target: 4, needs: ["npc"], text: "跟{npc}闲聊几句家常" },
  // ---- move ×12 ----
  { id: "move_dir", kind: "move", target: 12, needs: ["direction"], text: "往{direction}走" },
  // ---- inspect_container ×12 ----
  { id: "inspect_box", kind: "inspect_container", target: 6, needs: [], text: "翻翻四周的箱笼柜箧，看看有什么东西" },
  { id: "inspect_corner", kind: "inspect_container", target: 6, needs: [], text: "仔细搜搜墙角和灶台，看有没有藏着的物件" },
  // ---- take ×10 ----
  { id: "take_ground", kind: "take", target: 5, needs: ["ground"], text: "捡起地上的{ground}" },
  { id: "take_any", kind: "take", target: 5, needs: [], text: "看看地上有什么可捡的，捡起来" },
  // ---- give ×12 ----
  { id: "give_item", kind: "give", target: 6, needs: ["npc", "item"], text: "把{item}送给{npc}" },
  { id: "give_food", kind: "give", target: 6, needs: ["npc", "food"], text: "把{food}递给{npc}，请他尝尝" },
  // ---- trade ×12 ----
  { id: "trade_ask", kind: "trade", target: 6, needs: ["npc"], text: "问问{npc}这里都有什么货，怎么个卖法" },
  { id: "trade_buy", kind: "trade", target: 6, needs: ["npc"], text: "向{npc}买一件顺手的家伙什" },
  // ---- steal ×10 ----
  { id: "steal_npc", kind: "steal", target: 10, needs: ["npc"], text: "趁{npc}不备，偷他身上的东西" },
  // ---- duel ×10 ----
  { id: "duel_npc", kind: "duel", target: 10, needs: ["npc"], text: "向{npc}抱拳邀战，切磋几招" },
  // ---- appease ×10 ----
  { id: "appease_npc", kind: "appease", target: 10, needs: ["npc"], text: "向{npc}作揖赔罪，说些好话赔个不是" },
  // ---- learn ×10 ----
  { id: "learn_npc", kind: "learn", target: 10, needs: ["npc"], text: "求{npc}指点几手武艺" },
  // ---- invite ×10 ----
  { id: "invite_npc", kind: "invite", target: 10, needs: ["npc"], text: "邀{npc}与我结伴同行" },
  // ---- use_item ×10 ----
  { id: "use_food", kind: "use_item", target: 10, needs: ["food"], text: "吃一口{food}垫垫肚子" },
  // ---- equip ×10 ----
  { id: "equip_weapon", kind: "equip", target: 5, needs: ["weapon"], text: "把{weapon}装备起来握在手中" },
  { id: "unequip_weapon", kind: "equip", target: 5, needs: ["weapon"], text: "卸下{weapon}收回包袱" },
  // ---- free_act 十 outcome ×6 ----
  { id: "fa_none", kind: "free_act", outcome: "无", target: 6, needs: [], text: "坐在门槛上发呆看天色" },
  { id: "fa_hurt", kind: "free_act", outcome: "伤损", target: 6, needs: [], text: "攀爬院墙翻上墙头练胆" },
  { id: "fa_gain", kind: "free_act", outcome: "得财", target: 6, needs: [], text: "在村边的草丛石缝里碰碰运气寻值钱物什" },
  { id: "fa_spend", kind: "free_act", outcome: "破费", target: 6, needs: [], text: "掏出几两银子撒在路口祈福积德" },
  { id: "fa_meditate", kind: "free_act", outcome: "调息", target: 6, needs: [], text: "盘膝坐下打坐调息一个时辰" },
  { id: "fa_train", kind: "free_act", outcome: "修习", target: 6, needs: [], text: "修习内功心法，默运周天" },
  { id: "fa_consume", kind: "free_act", outcome: "服用", target: 6, needs: [], text: "捧起溪水喝了几口解渴" },
  { id: "fa_cold", kind: "free_act", outcome: "受寒中毒", target: 6, needs: [], text: "跳进冰冷的溪水里洗澡" },
  { id: "fa_drunk", kind: "free_act", outcome: "醉酒", target: 6, needs: [], text: "对着酒坛痛饮三碗烈酒" },
  { id: "fa_other", kind: "free_act", outcome: "其他", target: 6, needs: [], text: "帮村里人劈了一担柴" },
  // ---- settle 三类 ×5（文本触发软结算链，按意图标签另计）----
  { id: "settle_gift", kind: "give", settle: "gift", target: 5, needs: ["npc", "item"], text: "诚心把{item}赠予{npc}，权当一点心意" },
  { id: "settle_learn", kind: "learn", settle: "learn_skill", target: 5, needs: ["npc"], text: "诚心拜{npc}为师，求他传授一门本事" },
  { id: "settle_invite", kind: "invite", settle: "companion_invite", target: 5, needs: ["npc"], text: "诚心邀{npc}入伙结伴，一同闯荡江湖" },
  // ---- 群聊 ×5（一句话对多名在场者）----
  { id: "group_talk", kind: "talk", group: true, target: 5, needs: ["npc", "npc2"], text: "招呼{npc}和{npc2}一起过来，大伙坐下聊聊" },
  // ---- 条件动作 ×5 ----
  { id: "cond_move", kind: "move", conditional: true, target: 5, needs: ["direction"], text: "往{direction}走，要是遇到人就停下来搭话" },
];

// presence: { npcs: string[], inv: [{name, category}], exits: string[], ground: string[] }
// 返回 { ok, text } 或 { ok:false, reason }
export function fillTemplate(tpl, presence) {
  const slots = {};
  const npcs = (presence?.npcs || []).filter(Boolean);
  const inv = presence?.inv || [];
  const byCat = (cat) => inv.filter((i) => (i?.category || "") === cat).map((i) => i.name).filter(Boolean);
  const missing = [];
  for (const need of tpl.needs || []) {
    if (need === "npc") slots.npc = npcs[0];
    else if (need === "npc2") slots.npc2 = npcs.find((n) => n !== slots.npc);
    else if (need === "item") slots.item = inv.map((i) => i?.name || i).filter(Boolean)[0];
    else if (need === "food") slots.food = byCat("food")[0] || inv.map((i) => i?.name || i).find((n) => /青稞|干粮|饼|肉|酒|药/.test(n || ""));
    else if (need === "weapon") slots.weapon = byCat("weapon")[0];
    else if (need === "direction") {
      const dirMap = { n: "北", s: "南", e: "东", w: "西" };
      const d = (presence?.exits || [])[0];
      slots.direction = dirMap[d] || null;
    } else if (need === "ground") slots.ground = (presence?.ground || [])[0];
    if (need in slots && !slots[need]) missing.push(need);
    if (!(need in slots)) missing.push(need);
  }
  if (missing.length) return { ok: false, reason: `槽位缺料:${missing.join(",")}` };
  let text = tpl.text;
  for (const [k, v] of Object.entries(slots)) text = text.replaceAll(`{${k}}`, v);
  if (/\{[a-z0-9]+\}/i.test(text)) return { ok: false, reason: "槽位未填尽" };
  return { ok: true, text };
}

// 输入校验：序列项必须是非空字符串，否则整条序列不合格——宁可中止不进入付费采样。
export function validateSequence(seq) {
  if (!Array.isArray(seq) || !seq.length) return { ok: false, reason: "序列为空" };
  for (let i = 0; i < seq.length; i++) {
    if (typeof seq[i] !== "string" || !seq[i].trim()) {
      return { ok: false, reason: `第 ${i + 1} 项不是非空字符串`, index: i };
    }
  }
  return { ok: true };
}

// 配额选型：tracker = { templateId: usedCount }；返回下一条可用模板索引或 -1。
export function pickTemplate(presence, tracker = {}) {
  const skipped = [];
  for (let i = 0; i < TEMPLATES.length; i++) {
    const tpl = TEMPLATES[i];
    if ((tracker[tpl.id] || 0) >= tpl.target) continue;
    const filled = fillTemplate(tpl, presence);
    if (filled.ok) return { index: i, tpl, text: filled.text, skipped };
    skipped.push({ id: tpl.id, reason: filled.reason });
  }
  return { index: -1, tpl: null, text: null, skipped };
}
