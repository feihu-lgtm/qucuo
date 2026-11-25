// ── WO-23D3 铭文来历原文合规精确召回（纯函数）──────────────────────────
// 口径与 recall/visibility 完全一致：filterVisibleChunks 同一条过滤链
// （谱系 branchVisible+turn 不越当前+witnesses 主角/公共硬过滤），文本按
// viewer 现剥心理（visibleTextFor），绝不看弃坑分支/未来段/他人私密。
// 查询是器物名精确子串，优先「获得/赠刀/得宝」相关段，取最早者；取不到传空。
import { filterVisibleChunks, visibleTextFor } from "../memory/proseRecall.js";

// 获得语义关键词：段文含其一才优先入选（赠刀/得宝/捡到/买来…）。
// 两段都命中器物名时，获得段优先于普通提及段；同类内按 turn/seq 最早。
const ACQUIRE_RE = /赠|送|赐|授|得宝|捡|拾|买|购|铸|打了一|传与|交给你|塞给/;

export function findInscriptionOrigin(chunks, { itemName = "", viewer = "", currentTurn = 0, lineage = null } = {}) {
  if (!itemName || !Array.isArray(chunks) || !chunks.length) return "";
  const visible = filterVisibleChunks(chunks, viewer, { currentTurn, lineage });
  const hits = [];
  for (const c of visible) {
    const text = visibleTextFor(c, viewer);
    if (!text || !text.includes(itemName)) continue;
    hits.push({ c, text });
  }
  if (!hits.length) return "";
  const order = (h) => (Number.isFinite(h.c?.turn) ? h.c.turn : 0) * 1e4 + (Number.isFinite(h.c?.seq) ? h.c.seq : 0);
  hits.sort((a, b) => {
    const acqA = ACQUIRE_RE.test(a.text) ? 0 : 1;
    const acqB = ACQUIRE_RE.test(b.text) ? 0 : 1;
    if (acqA !== acqB) return acqA - acqB;
    return order(a) - order(b);
  });
  return hits[0].text.slice(0, 120);
}
