// W-ROAM 十回合交互驻足锁（原 commitRound 外新增后置处理器）──
// 玩家本轮「找过」的在场角色写 varTree.世界.驻足锁[name] = currentTurn + 10：
// 锁期内 roam.js 的随机游走与时段表换班一律跳过——正说着话/办着事的人
// 绝不当面瞬移走开；10 回合没再理他后自动恢复正常作息。
// 名字来源合并五处：听意单全部具名 target（intakeTargets）、SEAL respondedNpcs、
// 系统推导 derivedRespondedNpcs、按钮/指令显式指向的 activeTarget/talkTarget、
// 软结算对象 settleNpc。只钉此刻在场者（systemAcceptedNames 口径，含随行同伴），
// 隔空提及不钉；顺手清理 unlockAt <= currentTurn 的过期键防存档膨胀。
export function writeRoamLocks({ intakeTargets, respondedNpcs, derivedRespondedNpcs, activeTarget, talkTarget, settleNpc, presentNames, time }) {
  const names = [...new Set([
    ...(intakeTargets || []),
    ...(respondedNpcs || []),
    ...(derivedRespondedNpcs || []),
    activeTarget, talkTarget, settleNpc,
  ].filter((n) => typeof n === "string" && n && n !== "无" && presentNames?.has(n)))];
  return {
    changes: {
      varTree: (prev) => {
        const world = prev?.世界 || {};
        const old = world.驻足锁 || {};
        const cleaned = Object.fromEntries(Object.entries(old).filter(([, until]) => until > time));
        let changed = Object.keys(cleaned).length !== Object.keys(old).length;
        for (const name of names) {
          if (cleaned[name] !== time + 10) { cleaned[name] = time + 10; changed = true; }
        }
        if (!changed) return prev;
        return { ...prev, 世界: { ...world, 驻足锁: cleaned } };
      },
    },
  };
}
