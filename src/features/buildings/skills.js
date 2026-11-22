// 学艺：武馆购秘籍 / 墓壁参悟。
// 从 logic.js 按动作分组拆出。
import { makeSkillEntry } from "../../domain/kungfu/qucuoKungfu.js";
import { invalidAmountResult, noOpResult } from "./helpers.js";

export function buySkill(state, catalogItem) {
  if (!catalogItem?.id || (state.skills || []).some((skill) => skill.id === catalogItem.id)) return noOpResult();

  if (catalogItem.insight) {
    const current = state.char?.[catalogItem.insight.stat] ?? 0;
    if (current < catalogItem.insight.threshold) return noOpResult();
  } else {
    if (!Number.isFinite(catalogItem.price) || catalogItem.price < 0) return invalidAmountResult();
    if ((state.char.money || 0) < catalogItem.price) return noOpResult();
  }

  const changes = {
    skills: [...(state.skills || []), makeSkillEntry(catalogItem)],
  };
  if (!catalogItem.insight) {
    changes.char = { ...state.char, money: (state.char.money || 0) - catalogItem.price };
  }

  return {
    changes,
    settle: catalogItem.insight
      ? `在墓壁前站了许久，那些剑痕忽然连成了路数——参悟「${catalogItem.name}」`
      : `购得秘籍「${catalogItem.name}」，费银${catalogItem.price}两，习得此功`,
  };
}
