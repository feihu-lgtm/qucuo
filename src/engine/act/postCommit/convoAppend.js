// ── convo 条目追加 memory/turn 字段（原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { changes: { convo } } 由 commitRound 统一落盘。

export function appendConvo({ newConvo, rawFull, p, time, derivedRespondedNpcs, roomName = "", innerRoomName = null }) {
  // W-INPUT：回话角色随 convo 落条——下一轮前哨拿上轮 respondedNpcs[0] 作指代候选，
  // 不另造状态通道。系统推导优先，SEAL 自证兜底。
  const responded = [
    ...(Array.isArray(derivedRespondedNpcs) ? derivedRespondedNpcs : []),
    ...(Array.isArray(p?.respondedNpcs) ? p.respondedNpcs : []),
  ].filter((n) => typeof n === "string" && n && n !== "无");
  return {
    changes: {
      convo: [...newConvo, {
        role: "assistant",
        content: rawFull.slice(0, 500),
        memory: (p?.memory && String(p.memory).trim()) || "",
        turn: time,
        // V4 跨房知情隔离：记下本轮发生的房间，历史块拼装时对「他处旧幕」
        // 加房间头标记，当前房间的不知情者不得复述他处密谈细节。
        ...(roomName ? { room: roomName, innerRoomName: innerRoomName ?? null } : {}),
        ...(responded.length ? { respondedNpcs: [...new Set(responded)] } : {}),
      }],
    },
  };
}
