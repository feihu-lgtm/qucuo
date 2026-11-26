// WO-13 说书人流式锚点剥离器：onChunk 滑动缓冲。
// 实时剥除正文中的 ⟦F\d+_\d+⟧ 锚点再上屏（记录每个锚点落在第几自然段）；
// 一旦检测到 \n---SEAL--- 立即冻结屏幕文本流，后续字符只进尾章缓冲区。
// 纯函数式工厂，禁 Date.now/Math.random。

const ANCHOR_RE = /⟦(F\d+_\d+)⟧/g;
const SEAL_MARK = "\n---SEAL---";
// 锚点/SEAL 标记可能跨 chunk 到达：尾部保留 HOLD 字不复查，防半截标记上屏。
// V1：⟦⟧ 内部标记最长 60 字内容+双括号，跨 chunk 半截标记至少需保留 62 字不复查，
// 否则 ⟦PROGRESS_CULTIVATION·...⟧ 一类长标记会截半裸泄公屏。
const HOLD = 64;

export function createStorytellerStream({ onScreen } = {}) {
  let pending = "";        // 未终审的滑动缓冲
  let screenText = "";     // 已上屏的正文（锚点已剥）
  let sealText = "";       // 尾章缓冲区
  let sealed = false;      // SEAL 标记出现后为 true：屏幕冻结
  const anchors = [];      // { id, paragraph } 段落按当时上屏正文的 \n 数计

  const emit = (text) => {
    if (!text) return;
    screenText += text;
    onScreen?.(screenText);
  };

  // 剥锚点并记录段落；sealBefore=true 时这段已确定在 SEAL 之前。
  // V1：F\d+_\d+ 抽取记账保留，其余全部 ⟦...⟧ 内部标记（⟦W8_1⟧/⟦PROGRESS_CULTIVATION·...⟧
  // /⟦OP·...⟧ 等）在写入玩家可见正文前一并剥除，杜绝裸泄公屏。
  const INNER_MARK_RE = /⟦[^⟧]{1,60}⟧/g;
  const stripAnchors = (text) => {
    let out = "";
    let last = 0;
    ANCHOR_RE.lastIndex = 0;
    let m;
    while ((m = ANCHOR_RE.exec(text)) !== null) {
      out += text.slice(last, m.index);
      const paragraph = (screenText + out).split("\n").length - 1;
      if (!anchors.some((a) => a.id === m[1])) anchors.push({ id: m[1], paragraph });
      last = m.index + m[0].length;
    }
    out += text.slice(last);
    INNER_MARK_RE.lastIndex = 0;
    return out.replace(INNER_MARK_RE, "");
  };

  // 把 pending 中可终审的部分推到屏幕/尾章。
  const flush = (final = false) => {
    while (pending.length) {
      if (sealed) {
        sealText += pending;
        pending = "";
        break;
      }
      const sealAt = pending.indexOf(SEAL_MARK);
      if (sealAt !== -1) {
        // 标记前的正文剥锚上屏（SEAL 前的 \n 不显示），随后冻结屏幕
        const before = pending.slice(0, sealAt);
        emit(stripAnchors(before));
        sealed = true;
        pending = pending.slice(sealAt + SEAL_MARK.length);
        continue;
      }
      // 没找到完整 SEAL：可能是半截标记压在尾部。终审安全区 = 全长减 HOLD。
      let safeLen = final ? pending.length : Math.max(0, pending.length - HOLD);
      // Review 修：安全区内若有未闭合的 ⟦（标记头在安全区、标记尾在持有区），
      // 半截标记会原样漏上屏——一律回退到该 ⟦ 之前持有，等闭合后整体剥除。
      if (!final && safeLen > 0) {
        const frag = pending.slice(0, safeLen);
        const openIdx = frag.lastIndexOf("⟦");
        if (openIdx !== -1 && frag.indexOf("⟧", openIdx) === -1) safeLen = openIdx;
      }
      if (!safeLen) break;
      // 但安全区尾巴若像锚点/SEAL 的开头（⟦ 或 \n---），非 final 时也要再等等——
      // HOLD 已覆盖最长标记，此处直接判安全区可审。
      // final 终审段也剥 dangling 未闭合标记头——残头属内部标记不裸泄。
      const strippedSafe = stripAnchors(pending.slice(0, safeLen));
      emit(final ? strippedSafe.replace(/⟦[^⟧]{0,60}$/, "") : strippedSafe);
      pending = pending.slice(safeLen);
      if (!final) break;
    }
    if (final && pending.length) {
      if (sealed) {
        sealText += pending;
      } else {
        // 永不闭合的 dangling ⟦ 残头也按内部标记剥除——宁可截尾不裸泄。
        emit(stripAnchors(pending).replace(/⟦[^⟧]{0,60}$/, ""));
      }
      pending = "";
    }
  };

  return {
    push(chunk) {
      pending += String(chunk ?? "");
      flush(false);
    },
    finish() {
      flush(true);
      return { screenText, sealText, sealed, anchors: anchors.map((a) => ({ ...a })) };
    },
    // 快照：当前屏幕正文（供流式进行中渲染）
    get screenText() { return screenText; },
    get sealed() { return sealed; },
  };
}

// 非流式整文本的一次性版本：同规则剥锚点、切 SEAL。
export function splitStorytellerText(text) {
  const stream = createStorytellerStream();
  stream.push(text);
  return stream.finish();
}
