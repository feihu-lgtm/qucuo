// ── 小纸条·向量写入（异步副作用，原 commitRound 内嵌块）──
// 路线甲纯函数化：返回 { effects } 由 commitRound 统一触发；varTree 改显式入参。
import { embeddingReady } from "../../ports/embeddingService.js";
import { NOTE_SOURCE, VIA } from "../../../domain/rules/memory/note.js";
import { writeNote } from "../../ports/noteMemory.js";
import { QUCUO_MAP } from "../../../domain/data/map/qucuoMap.js";

export function writeMemoryNote({ p, apiCfg, room, activeTarget, isTalk, talkTarget, time, varTree }) {
  if (!embeddingReady(apiCfg) || !p.memory) return null;
  const roomNpcs = (p.room && Array.isArray(p.room.npcs) ? p.room.npcs : room.npcs) || [];
  const knownNames = Array.from(new Set([
    ...roomNpcs.map(n => n.name),
    ...Object.keys(varTree?.角色 || {}),
    ...Object.keys(QUCUO_MAP),
  ]));
  const noteOwner = (activeTarget || (isTalk && talkTarget)) ? [{ name: activeTarget || talkTarget, via: VIA.FIRSTHAND }] : [];
  const noteSource = isTalk ? NOTE_SOURCE.TALK : NOTE_SOURCE.NARRATIVE;
  return {
    effects: [
      () => writeNote({ cfg: apiCfg, text: p.memory, turn: time, knownNames, owner: noteOwner, source: noteSource, place: room.name })
        .catch(err => console.warn("小纸条写入失败（不影响本轮）：", err)),
    ],
  };
}
