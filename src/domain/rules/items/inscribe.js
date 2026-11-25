// ── WO-23D2 器物觉醒铭文与升品（deterministic 半截：校验+升品规划纯函数）────
// 铁律：系统决定何时可觉醒/是否升品/升哪档；AI 只写铭文文案，绝不能定成败数值。
import { QUALITIES as QUALITY_ORDER } from "../time/rules.js";
import { updateField, set } from "../state/applyWrite.js";

// 铭文校验（deterministic）：中文 8-60 字；不得含数字/英文/脏词/玩家名/
// 夸大境界或数值承诺。不合格调用方最多重试一次，再失败静默不升级。
const BANNED_WORDS = ["无敌", "天下第一", "秒杀", "必中", "必胜", "境界", "飞升", "成仙", "+", "%"];
const PROFANITY = ["妈的", "操你", "废物", "滚蛋"];
export function validateInscription(text, { playerName = "" } = {}) {
  const t = String(text || "").trim();
  if (!t) return { ok: false, reason: "empty" };
  if (t.length < 8 || t.length > 60) return { ok: false, reason: "length" };
  if (/[0-9A-Za-z]/.test(t)) return { ok: false, reason: "alnum" };
  if (!/[一-鿿]/.test(t)) return { ok: false, reason: "notChinese" };
  if (BANNED_WORDS.some((w) => t.includes(w))) return { ok: false, reason: "boast" };
  if (PROFANITY.some((w) => t.includes(w))) return { ok: false, reason: "profanity" };
  if (playerName && t.includes(playerName)) return { ok: false, reason: "playerName" };
  return { ok: true };
}

// 升一档：白→绿→蓝→紫→橙→红；已红/不在序列/已觉醒返回 null（不得进候选）。
export function nextQualityRung(quality) {
  const i = QUALITY_ORDER.indexOf(quality || "白");
  if (i < 0 || i >= QUALITY_ORDER.length - 1) return null;
  return QUALITY_ORDER[i + 1];
}

// 升品+账本落铭文（纯函数 feature result）：前置条件全在系统侧复核——
// 背包内按 id 精确寻址、ledger awakenReady && !awakened、quality 可升、铭文已过校验。
// 任一不满足返回 null（幂等：重复提交/已觉醒/被脱下不重复升、不写账）。
export function planInscriptionUpgrade(state, itemId, inscription) {
  const ledger = state?.varTree?.世界?.器物谱 || {};
  const entry = ledger[itemId];
  if (!entry?.awakenReady || entry.awakened) return null;
  const inv = Array.isArray(state?.inv) ? state.inv : [];
  const item = inv.find((it) => typeof it === "object" && it?.id === itemId);
  if (!item || item.category !== "weapon" || !item.equipped) return null;
  const rung = nextQualityRung(item.quality);
  if (!rung) return null;
  if (!validateInscription(inscription, { playerName: state?.char?.name || "" }).ok) return null;

  const changes = {
    inv: updateField("inv", (prev) => set("inv",
      (prev || []).map((it) => (typeof it === "object" && it?.id === itemId
        ? { ...it, quality: rung, inscription } : it)))),
    varTree: (prev) => ({
      ...(prev || {}),
      世界: {
        ...(prev?.世界 || {}),
        器物谱: {
          ...(prev?.世界?.器物谱 || {}),
          [itemId]: {
            ...(prev?.世界?.器物谱?.[itemId] || {}),
            awakened: true, awakenReady: false, inscription,
          },
        },
      },
    }),
  };
  return {
    feature: "items.inscribe",
    changes,
    logs: [
      { t: "item", text: `  你抚着「${item.name}」，一字一字刻下铭文——${inscription}` },
      { t: "sys", text: `  「${item.name}」灵性已醒，品阶升至${rung}。` },
    ],
  };
}
