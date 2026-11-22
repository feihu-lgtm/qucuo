import { random } from "../../core/rng.js";
import { ITEM_CATEGORY, makeItem } from "../../domain/rules/economy/equipment.js";
import { makeItemSmart } from "../../domain/data/items/catalog.js";
import { CHANG_KOU, JADE_TIERS } from "../../domain/rules/economy/gambleStone.js";
import { NOTE_SOURCE } from "../../domain/rules/memory/note.js";

const noOpResult = () => ({ logs: [] });
const invalidAmountResult = () => ({ logs: [{ t: "err", text: "  数额无效" }] });
const isPositiveAmount = (amount) => Number.isFinite(amount) && amount > 0;
const makeGameItem = (spec) => makeItemSmart(spec, makeItem);

const FORGE_EFFECT_LABELS = {
  forceFirst: "出手极快、抢在人前", ignoreDefense: "刃口锋锐、能透甲破防", doubleVsStatus: "专克身有滞碍之敌",
  lowHpBonus: "越是绝境越见威力", afterStatusBonus: "善趁敌中招时追击", detonateMark: "能引爆积在敌身的内伤",
  enemyCostPenalty: "缠身封穴、令敌耗力", freezeEnergyRecovery: "寒气封息、阻敌回气", applyMark: "着身留下内伤暗印",
  onCounterSuccessDamageRatio: "以守反攻、格挡后反噬更狠", onCounterSuccessEnergyGain: "格挡得手便回一口真气",
  hpRestore: "贴身温养、缓缓回血", energyRestore: "起手先饱一口真元",
};

const JADE_EFFECT_LABELS = {
  forceFirst: "出手极快、抢在人前", ignoreDefense: "锋锐透甲", doubleVsStatus: "专克身有滞碍之敌",
  lowHpBonus: "绝境愈见威力", afterStatusBonus: "善趁敌中招追击", detonateMark: "引爆敌身内伤",
  enemyCostPenalty: "缠身封穴令敌耗力", freezeEnergyRecovery: "寒气封息阻敌回气", applyMark: "着身留内伤暗印",
  onCounterSuccessDamageRatio: "以守反攻反噬更狠", onCounterSuccessEnergyGain: "格挡回气",
  hpRestore: "贴身温养回血", energyRestore: "起手先饱一口真元",
};

function traitClause(spec, labels) {
  const traits = [];
  for (const key of Object.keys(spec.effect || {})) {
    if (labels[key]) traits.push(labels[key]);
  }
  for (const [key, value] of Object.entries(spec.sixDim || {})) {
    traits.push(`养${key}(+${value})`);
  }
  return traits.length ? `这件东西的讲究在于：${traits.join("；")}。` : "";
}

export function settleGambleStone(state, res, now = Date.now()) {
  if (!res || typeof res !== "object") return noOpResult();

  if (res.type === "buy") {
    if (!isPositiveAmount(res.price)) return invalidAmountResult();
    if ((state.char.money || 0) < res.price) return noOpResult();
    return {
      changes: {
        char: { ...state.char, money: (state.char.money || 0) - res.price },
      },
      logs: [{ t: "item", text: `  💰 你相中一块${res.changKouLabel || ""}毛料，付${res.price}两买下，就地开切。` }],
      note: { text: `在玉石料场花${res.price}两买下一块赌石毛料。`, source: NOTE_SOURCE.DUMB },
    };
  }

  if (res.type === "keep") {
    const stone = res.stone;
    if (!stone) return noOpResult();
    const tier = JADE_TIERS.find((entry) => entry.key === stone.jadeTier) || {};
    const tierLabel = tier.label || "玉料";
    const cap = tier.quality || stone.quality || "白";
    const changKouLabel = CHANG_KOU[stone.changKou]?.label || "";
    const jadeItem = {
      name: `${tierLabel}·玉料`,
      category: ITEM_CATEGORY.MISC,
      quality: cap,
      desc: `${changKouLabel ? `${changKouLabel}开出的` : ""}一块${tierLabel}玉料，品质${cap}。可拿去金玉行雕琢成器。`,
      jadeSpec: { jadeTier: stone.jadeTier, qualityCap: cap, changKou: stone.changKou, tierLabel },
    };
    return {
      changes: {
        inv: [...(state.inv || []), { ...jadeItem, id: `jade_${now}_${random().toString(36).slice(2, 5)}` }],
      },
      logs: [{ t: "item", text: `  💎 你把这块「${tierLabel}」料收入行囊，日后可去金玉行请玉匠雕琢成器。` }],
      note: { text: `在玉石料场开出一块${tierLabel}玉料，收进了行囊。`, source: NOTE_SOURCE.NARRATIVE },
    };
  }

  if (res.type === "sell") {
    if (!isPositiveAmount(res.price)) return invalidAmountResult();
    return {
      changes: {
        char: { ...state.char, money: (state.char.money || 0) + res.price },
      },
      settle: `在天都镇玉石料场，把开出的料子卖给${res.bidderName || "买家"}，得银${res.price}两`,
      settleOptions: { settleNpc: res.bidderName || null },
    };
  }

  if (res.type === "forge") {
    if (!res.result) return noOpResult();
    if ((state.char.money || 0) < 200) return noOpResult();
    const result = res.result;
    const success = result.result === "success";
    return {
      changes: {
        char: { ...state.char, money: (state.char.money || 0) - 200 },
      },
      settle: success
        ? `在天都镇玉石料场，把开出的料子委托温掌柜的老工匠雕琢，做成一件${result.quality}档玉器`
        : result.result === "stolen"
          ? "在天都镇玉石料场委托做玉器，料却被料场老师傅偷梁换柱，血本无归"
          : "在天都镇玉石料场委托做玉器，料在砣机上崩废了",
      settleOptions: success
        ? { settleNpc: "温掌柜" }
        : { settle: false },
    };
  }

  return noOpResult();
}

export function commissionForge(state, { chosen, luck, currentTime = state.time, cost, threeFields } = {}) {
  if (!chosen?.name) return noOpResult();
  if (!isPositiveAmount(cost)) return invalidAmountResult();
  if ((state.char.money || 0) < cost) return noOpResult();

  const spec = {
    name: chosen.name,
    category: chosen.category || "weapon",
    effect: chosen.effect || {},
    sixDim: chosen.sixDim || {},
    material: (threeFields?.material || "").trim(),
    requirement: (threeFields?.requirement || "").trim(),
  };
  const catCN = { weapon: "兵器", armor: "护具", accessory: "饰物" }[spec.category] || "物件";
  const traits = traitClause(spec, FORGE_EFFECT_LABELS);
  const matPart = spec.material ? `玩家拿「${spec.material}」来打` : "玩家来定制";
  const reqPart = spec.requirement ? `，要的是「${spec.requirement}」的路子` : "";
  const matClause = `${matPart}一件${catCN}「${chosen.name}」${reqPart}，已当场付清定金${cost}两。${traits}请让铁匠据此接单：对这材料成色脾性、这活计的打法、以及要打出上面这些讲究，说道一两句(内行见识、增代入感)，交代约二十四个时辰后打成、届时遣伙计送货上门。`;
  const encodedSpec = encodeURIComponent(JSON.stringify(spec));
  return {
    changes: {
      char: { ...state.char, money: (state.char.money || 0) - cost },
      flags: [...(state.flags || []), `forge_pending_${currentTime}_${luck}_${encodedSpec}`],
    },
    settle: `到铁匠铺定制${catCN}「${chosen.name}」，付${cost}两定金。${matClause}`,
  };
}

export function craftJade(state, { chosen, jadeItemId, currentTime = state.time, threeFields } = {}) {
  if (!chosen?.name) return noOpResult();
  const jade = (state.inv || []).find((item) => typeof item === "object" && item.id === jadeItemId && item.jadeSpec);
  if (!jade) {
    return { logs: [{ t: "err", text: "  找不到要用的玉料，先去赌石开一块料收进行囊。" }] };
  }

  const qualityCap = jade.jadeSpec?.qualityCap || jade.quality || "白";
  const spec = {
    name: chosen.name,
    category: chosen.category || "accessory",
    effect: chosen.effect || {},
    sixDim: chosen.sixDim || {},
    material: (threeFields?.material || jade.jadeSpec?.tierLabel || "玉料"),
    requirement: (threeFields?.requirement || "").trim(),
    jade: true,
    qualityCap,
  };
  const luck = state.char.special?.气运 ?? 5;
  const catCN = { weapon: "玉兵", armor: "玉甲", accessory: "玉饰" }[spec.category] || "玉器";
  const traits = traitClause(spec, JADE_EFFECT_LABELS);
  const encodedSpec = encodeURIComponent(JSON.stringify(spec));
  return {
    changes: {
      inv: (state.inv || []).filter((item) => !(typeof item === "object" && item.id === jadeItemId)),
      flags: [...(state.flags || []), `forge_pending_${currentTime}_${luck}_${encodedSpec}`],
    },
    settle: `到金玉行，把一块「${jade.jadeSpec?.tierLabel || "玉料"}」交给玉匠，请雕一件${catCN}「${chosen.name}」。${traits}玉料已当场交付、活计已接。请让玉匠据料的种水成色、这活的雕法、要出的讲究说道一两句(内行见识、增代入感)，交代约二十四个时辰后雕成、届时遣伙计送来。`,
  };
}
