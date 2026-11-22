// ── 小纸条·向量写入（异步副作用，原 commitRound 内嵌块）──
import { embeddingReady } from "../../ports/embeddingService.js";
import { NOTE_SOURCE, VIA } from "../../../domain/rules/memory/note.js";
import { writeNote } from "../../ports/noteMemory.js";
import { QUCUO_MAP } from "../../../domain/data/map/qucuoMap.js";

export function writeMemoryNote(d) {
  if (embeddingReady(d.apiCfg) && d.p.memory) {
    const roomNpcs = (d.p.room && Array.isArray(d.p.room.npcs) ? d.p.room.npcs : d.room.npcs) || [];
    const knownNames = Array.from(new Set([
      ...roomNpcs.map(n => n.name),
      ...Object.keys(d.varTreeRef.current.角色 || {}),
      ...Object.keys(QUCUO_MAP),
    ]));
    const noteOwner = (d.activeTarget || (d.isTalk && d.talkTarget)) ? [{ name: d.activeTarget || d.talkTarget, via: VIA.FIRSTHAND }] : [];
    const noteSource = d.isTalk ? NOTE_SOURCE.TALK : NOTE_SOURCE.NARRATIVE;
    writeNote({ cfg: d.apiCfg, text: d.p.memory, turn: d.time, knownNames, owner: noteOwner, source: noteSource, place: d.room.name })
      .catch(err => console.warn("小纸条写入失败（不影响本轮）：", err));
  }
}
