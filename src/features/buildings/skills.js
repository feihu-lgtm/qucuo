// 学艺：武馆购秘籍 / 墓壁参悟。
// 从 logic.js 按动作分组拆出。
import { makeSkillEntry } from "../../domain/data/kungfu/qucuoKungfu.js";
import { skillPrice, skillUnlockStatus } from "../../domain/rules/economy/skillUnlock.js";
import { invalidAmountResult, noOpResult } from "./helpers.js";
import { hostileClosureOf, strongholdBan } from "../../domain/rules/economy/strongholdGate.js";
import { getBuildingIdForInnerRoom } from "../../domain/rules/map/innerMap.js";

export function buySkill(state, catalogItem) {
  if (!catalogItem?.id || (state.skills || []).some((skill) => skill.id === catalogItem.id)) return noOpResult();

  const ban = strongholdBan(state.room?.name, state.varTree);
  if (ban) return { logs: [{ t: "sys", text: `  ${ban.closed}` }] };
  const closure = hostileClosureOf(getBuildingIdForInnerRoom(state.room?.name, state.innerRoomName), state.varTree);
  if (closure) return { logs: [{ t: "sys", text: `  ${closure.closed}` }] };

  const unlock = skillUnlockStatus(state, catalogItem);
  const price = skillPrice(state, catalogItem);
  if (!unlock.ok) return { logs: [{ t: "sys", text: `  「${catalogItem.name}」尚不可学：${unlock.reason}` }] };

  if (catalogItem.insight) {
    const current = state.char?.[catalogItem.insight.stat] ?? 0;
    if (current < catalogItem.insight.threshold) return noOpResult();
  } else {
    if (!Number.isFinite(catalogItem.price) || catalogItem.price < 0) return invalidAmountResult();
    if ((state.char.money || 0) < price) return noOpResult();
  }

  const changes = {
    skills: [...(state.skills || []), makeSkillEntry(catalogItem)],
  };
  if (!catalogItem.insight) {
    changes.char = { ...state.char, money: (state.char.money || 0) - price };
  }

  return {
    changes,
    settle: catalogItem.insight
      ? `在墓壁前站了许久，那些剑痕忽然连成了路数——参悟「${catalogItem.name}」`
      : `购得秘籍「${catalogItem.name}」，费银${price}两，习得此功`,
  };
}
