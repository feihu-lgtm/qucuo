// ── D3 条件动作确定性裁决（纯函数）──
// intake 动作可带 condition（遇敌/到达/被拒/其他）+condition_text。
// 裁决口径保守：无法确证一律按未成立处理，绝不放行模糊前提。

// evaluateActionCondition(action, ctx)
// ctx = {
//   encounter,            // 本回合敌袭对象（无则 null/undefined）
//   moved,                // 本回合已发生移动（前置路由 move 成功或系统移动回合抵达）
//   roomName,             // 当前据点名（前置路由执行后刷新值）
//   innerRoomName,        // 当前内层房间名（同上）
//   visibleNpcs,          // 在场 NPC 数组（同上）
//   lastActionOutcome,    // { rejected, kind, target } 同回合前序拒收信号
// }
export function evaluateActionCondition(action, ctx = {}) {
  const cond = String(action?.condition || "").trim();
  if (!cond || cond === "无") return { met: true };

  if (cond === "遇敌") {
    if (ctx.encounter) return { met: true };
    return { met: false, reason: "本回合未遇敌袭" };
  }

  if (cond === "到达") {
    if (!ctx.moved) return { met: false, reason: "尚未抵达所指之处" };
    // condition_text 含具体地名时，须与当前房间/据点匹配才算真正到达
    const text = String(action?.condition_text || "");
    if (text) {
      const places = [ctx.innerRoomName, ctx.roomName].filter(Boolean);
      const hit = places.some((p) => text.includes(p) || p.includes(text.replace(/\s/g, "")));
      // 文本未提及任何可识别地名时按到达论（玩家只说「到了就……」）；
      // 提及地名但不匹配当前位置则未成立。
      const mentionsPlace = places.some((p) => p && text.includes(p));
      const mentionsOther = !mentionsPlace && /[村庙寨谷峰楼铺店庄城山厅房厨]/.test(text);
      if (mentionsOther) return { met: false, reason: "尚未抵达所指之处" };
      if (mentionsPlace || hit) return { met: true };
      return { met: true };
    }
    return { met: true };
  }

  if (cond === "被拒") {
    if (ctx.lastActionOutcome?.rejected) return { met: true };
    return { met: false, reason: "前一事并未遭拒" };
  }

  if (cond === "其他") {
    const text = String(action?.condition_text || "");
    const npcCount = (ctx.visibleNpcs || []).length;
    if (/没人|无人|四下无人|独处/.test(text)) {
      if (npcCount === 0) return { met: true };
      return { met: false, reason: "场上并非无人" };
    }
    if (/有人/.test(text) && !/没人|无人/.test(text)) {
      if (npcCount > 0) return { met: true };
      return { met: false, reason: "场上并无旁人" };
    }
    const m = text.match(/有(.{1,6})在/);
    if (m) {
      const name = m[1];
      const present = (ctx.visibleNpcs || []).some((n) => {
        const nm = n?.name ?? n;
        return nm && (nm.includes(name) || name.includes(nm));
      });
      if (present) return { met: true };
      return { met: false, reason: `「${name}」并不在场` };
    }
    return { met: false, reason: "前提无法确证，按未成立处理" };
  }

  // 未知条件类型：保守不成立
  return { met: false, reason: "前提无法确证，按未成立处理" };
}

// 条件未成立/成立的批注文案（工单 D3 规定原文）
export function conditionUnmetNote(action, reason) {
  return `条件未成立：「${action?.text || action?.kind}」所设前提（${action?.condition}，${reason}）本轮未达成，该动作未执行，正文只交代前提未成而作罢，严禁写成已经动手或已经得手。`;
}
export function conditionMetNote(action) {
  return `条件已达成：「${action?.text || action?.kind}」前提成立，按定案结果正常描写。`;
}
