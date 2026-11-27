// 中栏对白段落切分与说话人识别（纯函数）：
// 把一整条 desc 日志拆成自然段，识别有明确主语的「」对白段，
// 供 LogEntry 在「书页落像 / 行内小像 / 纯文」三档间切换。

const TARGET_PREPOSITIONS = /(?:对|朝|向|跟|同|给|冲|问|看着|望着|盯住)$/;

export function splitNarrativeParagraphs(text, knownNames = []) {
  const rawLines = String(text || "").split("\n");
  const candidates = [...new Set((knownNames || []).map((n) => String(n || "").trim()).filter((n) => n && n !== "你"))]
    .sort((a, b) => b.length - a.length);

  const out = [];
  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const speaker = detectDialogueSpeaker(trimmed, candidates);
    if (speaker) {
      out.push({ kind: "dialogue", speaker, text: rawLine });
    } else {
      out.push({ kind: "prose", text: rawLine });
    }
  }
  return out;
}

function detectDialogueSpeaker(trimmed, candidates) {
  if (!candidates.length) return null;
  const openIdx = trimmed.indexOf("「");
  if (openIdx === -1) return null;

  // 若整段一开头就是引号（如「……」元朵朵说道），看紧跟引号后面的动作主语
  if (openIdx === 0) {
    const closeIdx = trimmed.indexOf("」");
    if (closeIdx === -1) return null;
    const after = trimmed.slice(closeIdx + 1, closeIdx + 24).replace(/^[，,、\s]+/, "");
    for (const name of candidates) {
      if (after.startsWith(name)) return name;
    }
    return null;
  }

  const lead = trimmed.slice(0, openIdx).trim();
  // 玩家自己开口（且没有句末断句转交他人），不给 NPC 挂头像
  if (/^你(?![们]|我)/.test(lead) && !/[。；]/.test(lead)) return null;

  // 若前有句号/分号，只看最后一个分句里的主语（例如：你推门进屋。元朵朵抬起头，……「…」）
  const lastClause = lead.split(/[。；]/).pop()?.trim() || lead;
  if (/^你/.test(lastClause)) return null;

  // 1. 段首/分句首直接就是人物名，命中优先级最高
  for (const name of candidates) {
    if (lastClause.startsWith(name)) return name;
  }

  // 2. 分句中出现已知人物名（排除「对XX」「问XX」的受格位置）
  let best = null;
  let bestPos = -1;
  for (const name of candidates) {
    let idx = lastClause.indexOf(name);
    while (idx !== -1) {
      const prefix = lastClause.slice(Math.max(0, idx - 3), idx);
      if (!TARGET_PREPOSITIONS.test(prefix)) {
        if (idx > bestPos || (idx === bestPos && name.length > (best?.length || 0))) {
          best = name;
          bestPos = idx;
        }
      }
      idx = lastClause.indexOf(name, idx + name.length);
    }
  }
  return best;
}

export function parseDuelOpponent(bannerLabel) {
  const s = String(bannerLabel || "").trim();
  const m = s.match(/^与\s*(.+?)\s*切磋$/);
  return m ? m[1].trim() : null;
}
