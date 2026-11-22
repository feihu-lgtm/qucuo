import { add, set, updateField } from "../../domain/rules/state/applyWrite.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";
import { makeItem, QUALITY } from "../../domain/rules/economy/equipment.js";
import { makeSkillEntry, SKILL_CATALOG } from "../../domain/data/kungfu/qucuoKungfu.js";
import { commitModelFlags } from "./commitFlags.js";
import { applyPostResult } from "./postCommit/applyPostResult.js";

const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

export function commitProposalWrites(d, trace) {
  if (d.p.char && !d.isTalk && !d.giftAlreadySettled) {
    d.setChar((char) => {
      const { hp, ...changes } = d.p.char;
      const nextHp = d.preserveHp ? char.hp : hp ?? char.hp;
      const writes = Object.entries(changes).map(([key, value]) => set(`char.${key}`, value));
      if (hp !== undefined || d.gm || d.preserveHp) {
        writes.push(set("char.hp", d.gm && !d.preserveHp ? [nextHp[1], nextHp[1]] : nextHp));
      }
      return updateField("char", writes)(char);
    });
  }
  if (d.p.dao) { d.setDao(updateField("dao", Object.entries(d.p.dao).map(([key, value]) => set(`dao.${key}`, value)))); }
  // 本轮实际新增的物品名（string或{name}），供后面两道拾取兜底判断"这次到底有没有
  // 真的发过东西"——不能只看 d.p.delta 存不存在，AI 可能通过别的字段/根本没写 delta
  // 却仍在叙事里讲了拾取的事。
  let grantedThisTurnNames = [];
  if (!d.isTalk) {
    // judgment 的读取与清空必须在这里、且不依赖 d.p.delta 是否存在——此前这两行连同
    // 下面的"拾取判定兜底"整段都包在 if(d.p.delta && !d.isTalk) 里，一旦 AI 的响应
    // 解析失败或提取层异常导致 p 退化成 {}（d.p.delta 是 undefined），judgment 既不会
    // 被消费也不会被清空，会残留到下一回合、错误地把下一次行动的拾取强制对齐成
    // 这次没用上的品质/分类。
    const judgment = d.pickupJudgmentRef.current;
    let usedJudgment = false;
    if (d.p.delta?.items_add?.length && !d.giftAlreadySettled) {
      // 系统本轮已代发的采集物：即便 AI 又在 items_add 里塞了一份，也剔除，防重复入袋。
      const granted = d.collectGrantedRef.current || [];
      const rawAdds = granted.length
        ? d.p.delta.items_add.filter(i => !granted.includes(typeof i === "string" ? i : i.name))
        : d.p.delta.items_add;
      const newItems = rawAdds.map(i => {
        if (typeof i === "string") return i; // 兼容纯文本物品（杂物/剧情道具，不参与装备系统）
        // 系统裁决：如果本轮有拾取判定在先，第一件结构化物品的品质/分类强制对齐判定结果，
        // 不信任 AI 自己回传的 quality（防止其绕过气运概率机制乱给稀有品）
        let quality = i.quality || "白";
        let category = i.category || "misc";
        if (judgment && !usedJudgment) {
          quality = judgment.quality;
          category = judgment.category;
          usedJudgment = true;
        } else if (!QUALITY.includes(quality)) {
          quality = "白"; // AI 给了非法品质字符串时兜底
        }
        return makeGameItem({ name: i.name, category, quality, desc: i.desc || "" });
      });
      const addedNames = newItems.map(i => typeof i === "string" ? i : i.name);
      grantedThisTurnNames = addedNames;
      d.setInv(updateField("inv", (inv) => set("inv", [...inv, ...newItems])));
      d.setRoom(r => ({ ...r, items: r.items.filter(i => !addedNames.includes(i.name) && !addedNames.includes(i)) }));
    }
    // 拾取判定后处理，分两种情况：
    // (A) 提取成功但没产出拾取物（judgment 未消费、且提取没失败）→ 叙事判断此刻不宜捡
    //     （被盯着/险境），尊重叙事、本轮不发。这是正常且正确的行为。
    // (B) 提取层这次解析失败/调用异常（d.pickupExtractionFailedRef）→ 这是技术故障，不是
    //     叙事拒捡！主叙事很可能已写了捡到某物，却因提取模型抽风丢了。此时必须保底发放，
    //     绝不能让掷中的拾取因提取故障蒸发。名字用品质通用名（不再从散文正则抠名——
    //     抠名永远补不全量词/书名号变体，真正的解法是把提取层解析修健壮，见 cleanJsonString）；
    //     品质/分类用 judgment。
    if (judgment && !usedJudgment) {
      if (d.pickupExtractionFailedRef.current) {
        const name = `${judgment.quality === "白" ? "" : judgment.quality}品路遇之物`;
        const gained = makeGameItem({ name, category: judgment.category, quality: judgment.quality, desc: "路上拾得的物件。" });
        d.setInv(updateField("inv", (inv) => set("inv", [...inv, gained])));
        grantedThisTurnNames.push(name);
        d.addLog([{ t: "item", text: `  ✓ 你拾得「${name}」，收入行囊。` }]);
        trace("拾取判定", "info", `系统掷中拾取（品质「${judgment.quality}」），但提取层解析失败——按裁决保底发放「${name}」，不因提取故障丢物。`);
      } else {
        trace("拾取判定", "info", `系统本轮掷中拾取（品质「${judgment.quality}」），提取层正常但未产出拾取物——依叙事判断此刻不宜取物，本轮不发。`);
      }
    }
    d.pickupJudgmentRef.current = null;
    d.pickupExtractionFailedRef.current = false;
    // AI 自由发挥的拾取（系统没掷中拾取骰、但 AI 说书时自己写了"捡到 XX"）现在
    // 也由提取层读名、产在 delta.items_add，已随上面的正常 items_add 循环入袋，
    // 品质取"白"（系统未授权的自编拾取不给品质加成，避免 AI 靠多写拾取情节薅稀有
    // 物）。此前用 extractPickupName 正则从散文抠名那套已废弃（量词表补不全，"一件
    // 软甲"抠不到）。至此拾取物名一律走"读得懂语义的提取模型"，不再有任何正则抠名。
  }
  if (d.p.delta && !d.isTalk && !d.giftAlreadySettled) {
    if (d.p.delta.items_rm?.length) {
      const names = d.p.delta.items_rm.map(i => typeof i === 'string' ? i : i.name || String(i));
      d.setInv(updateField("inv", (inv) => set("inv", inv.filter((item) => !names.includes(typeof item === "string" ? item : item.name)))));
      d.setRoom(r => ({ ...r, items: [...r.items, ...names.map(n => ({ name: n, id: n }))] }));
    }
    if (d.p.delta.exp) d.setExp(updateField("exp", add("exp", d.p.delta.exp)));
    if (d.p.delta.pot) d.setPot(updateField("pot", add("pot", d.p.delta.pot)));
    if (d.p.delta.skill_up) {
      // 经验升阶已退役——stage 改由潜能主动突破（breakthroughSkill）。
      // skill_up 仅保留累积 exp 数值以兼容老存档/AI 叙事，不再自动改 stage/level。
      // 固定招（fixed，无 stage）直接跳过。
      d.setSkills(updateField("skills", (sk) => set("skills", sk.map(s => {
        if (s.fixed || s.stage == null) return s;
        const up = d.p.delta.skill_up[s.name];
        if (!up) return s;
        return { ...s, exp: (s.exp ?? 0) + up };
      }))));
    }
    if (d.p.delta.skills_add?.length) {
      const allCatalog = Object.values(SKILL_CATALOG).flat();
      d.setSkills(updateField("skills", (sk) => set("skills", [...sk, ...d.p.delta.skills_add.map(n => {
        const name = typeof n === "string" ? n : n.name || n;
        const hit = allCatalog.find(c => c.name === name);
        if (hit) return makeSkillEntry(hit); // 那10门可修炼武学：保留 stage，能潜能升阶
        // 非目录武学（AI 叙事里赠予/自创的招）：固定招，无 stage、不升阶，学即完整
        return { id: `learned_${name}`, name, type: "招式", quality: "白", moveType: null, fixed: true, stage: null, active: false };
      })])));
    }
  }
  applyPostResult(d, commitModelFlags({
    p: d.p, room: d.room, innerRoomName: d.innerRoomName,
    questProgress: d.questProgress, pendingQuestBranch: d.pendingQuestBranch,
  }));
}
