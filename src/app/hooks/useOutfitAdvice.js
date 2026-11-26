import { useCallback } from "react";
import { cleanJsonString } from "../../utils/jsonClean.js";
import { bodyProfileFilled } from "../../domain/rules/character/bodyProfile.js";
import { CATALOG_INDEX, CATALOG, makeCatalogItem } from "../../domain/data/items/catalog.js";
import { ITEM_CATEGORY, CATEGORY_LABEL } from "../../domain/rules/economy/equipment.js";
import { effectBrief } from "../../domain/rules/economy/itemEffectText.js";
import { createWebAi } from "../../engine/ports/ai.js";
import { withAI } from "../../engine/ports/withAI.js";
import "../calls/hookCalls.js";
import { QUALITY_COLOR } from "../../domain/data/items/qualityColor.js";

const webAi = createWebAi();

export function useOutfitAdvice({ char, apiCfg, setOutfitState }) {
  const recommendOutfit = useCallback(async () => {
    const profile = char.bodyProfile;
    if (bodyProfileFilled(profile).total === 0) {
      setOutfitState({ loading: false, picks: [], error: "先写点体貌，掌柜才有的可挑。" });
      return;
    }
    setOutfitState({ loading: true, picks: [], error: "" });
    try {
      // 货架 = 装备三类的全部具名+制式条目。杂货(misc)不是穿戴的，不进池子。
      const pool = CATALOG.filter(e =>
        e.category === ITEM_CATEGORY.WEAPON ||
        e.category === ITEM_CATEGORY.ARMOR ||
        e.category === ITEM_CATEGORY.ACCESSORY
      );
      const { text } = await withAI("outfit.advice", { profile, pool }, { ai: webAi, apiCfg });
      let parsed = {};
      try { parsed = JSON.parse(cleanJsonString(text.replace(/```json\s*|```\s*/g, "").trim())); }
      catch { parsed = {}; }

      const picks = (Array.isArray(parsed.picks) ? parsed.picks : [])
        .map(pick => {
          // 只认货架上真实存在的名字。AI 编出来的一律丢掉，不做模糊匹配——
          // "看起来像"的匹配一旦错了，玩家拿到的就是另一件东西的数值。
          const entry = CATALOG_INDEX[String(pick?.name || "").trim()];
          if (!entry) return null;
          const it = makeCatalogItem(entry);
          const bits = [];
          if (it.atk != null) bits.push(`攻 +${it.atk}`);
          if (it.def != null) bits.push(`防 +${it.def}`);
          if (it.sixDim) bits.push(Object.entries(it.sixDim).map(([k, v]) => `${k} +${v}`).join(" "));
          // 走 itemEffectText 那份唯一词典，别把 ignoreDefenseRatio 这种英文字段名打给玩家看
          if (it.effect) { const t = effectBrief(it.effect, null); if (t) bits.push(`特效：${t}`); }
          return {
            name: it.name,
            quality: it.quality,
            qualityColor: QUALITY_COLOR[it.quality] || "var(--text)",
            categoryLabel: CATEGORY_LABEL[it.category] || it.category,
            desc: it.desc,
            statLine: bits.join("　") || "无直接加成",
            reason: String(pick?.reason || "").trim(),
          };
        })
        .filter(Boolean)
        .slice(0, 3);

      if (!picks.length) {
        setOutfitState({ loading: false, picks: [], error: "掌柜报的名字货架上都没有，再点一次试试。" });
        return;
      }
      setOutfitState({ loading: false, picks, error: "" });
    } catch (e) {
      setOutfitState({ loading: false, picks: [], error: `掌柜没应声：${e.message || e}` });
    }
  }, [char.bodyProfile, apiCfg]);
  return { recommendOutfit };
}
