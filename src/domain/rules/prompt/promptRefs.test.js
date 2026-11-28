import { describe, expect, it, vi } from "vitest";
import {
  buildMainStatePrompt,
  buildWhisperStatePrompt,
  renderPromptTemplate,
  renderFieldScales,
  resolveRef,
} from "./promptRefs.js";
import { buildPrompt } from "./buildPrompt.js";
import "./calls/sideCalls.js";
import { AFFECTION_RULES, FIELD, FIELDS, WHISPER_AFFECTION_RULES } from "../state/fields.js";
import { buildNarratorWhisperContext } from "../narrator/narrator.js";
import { buildSysBase } from "./sysBase.js";
import { priceForQuality } from "../economy/equipment.js";
import { SERVICE_MENUS } from "../../data/buildings/menuData.js";

function promptState() {
  return {
    char: {
      name: "少侠", gender: "女", hp: [70, 100], neigong: 3, waigong: 4, money: 73,
      special: { 根骨: 5, 悟性: 6 },
    },
    inv: [{ name: "刀", quality: "蓝", equipped: true }, "草药"],
    skills: [{ name: "野球拳", level: 2 }],
    dao: { karma: 4, jie: 9 },
    flags: ["旗"],
    time: 6,
    getTimeStr: () => "第1日·卯初·06:00",
    room: {
      name: "鱼定村", desc: "村中喧闹", exits: ["n", "s"], items: [{ name: "石子" }],
      npcs: [
        { name: "货郎阿吉", innerRoom: "村口", levelCap: 2, carriedItems: [{ name: "猎刀" }] },
        { name: "老猎户", innerRoom: "别处" },
      ],
    },
    innerRoomName: "村口",
    quality: ["白", "绿", "蓝", "紫", "橙", "红"],
    describeEquipment: () => "佩刀",
    describeTodayForAI: () => "\n[今日起居] 打坐1次",
    varTree: { 角色: { 货郎阿吉: { 好感度: 37, 态度: "爽朗" } } },
  };
}

describe("prompt reference resolver", () => {
  it("resolves direct, nested, and named derived fields", () => {
    const state = promptState();
    expect(resolveRef(state, "room.name")).toBe("鱼定村");
    expect(resolveRef(state, "char.hp")).toEqual([70, 100]);
    expect(resolveRef(state, "主角.名")).toBe("少侠");
    expect(resolveRef(state, "varTree.角色.货郎阿吉.好感度")).toBe(37);
    expect(resolveRef(state, "角色.货郎阿吉.好感度")).toBe(37);
    expect(renderPromptTemplate("@气血 / @varTree.角色.货郎阿吉.好感度", state).text).toBe("70/100 / 37");
  });

  it("preserves ASCII combat refs before Han suffixes and does not reparse resolved text", () => {
    expect(renderPromptTemplate("第@round.round回合：@{room.name}后 @narrative", {
      ...promptState(), round: { round: 3 }, narrative: "@missing",
    })).toEqual({ text: "第3回合：鱼定村后 @missing", missingPaths: [] });
  });

  it("renders a missing path empty and reports it once to the trace callback", () => {
    const trace = vi.fn();
    const result = renderPromptTemplate(
      "@room.name @missing.value @missing.value",
      promptState(),
      { trace },
    );
    expect(result).toEqual({
      text: "鱼定村  ",
      missingPaths: ["missing.value"],
    });
    expect(trace).toHaveBeenCalledWith(["missing.value"]);
  });
});

describe("declared numeric scales", () => {
  const numbers = (text) => Array.from(text.matchAll(/[+-]?\d+(?:\.\d+)?/g), ([value]) => Number(value));
  const within = (text, { min = -Infinity, max = Infinity }, label) => {
    for (const value of numbers(text)) {
      expect(value, label).toBeGreaterThanOrEqual(min);
      expect(value, label).toBeLessThanOrEqual(max);
    }
  };

  it("fails on missing scale references or figures outside the declared bounds", () => {
    for (const [path, spec] of Object.entries(FIELDS)) {
      if (!spec.scale) continue;
      const { text, missingPaths } = renderPromptTemplate(spec.scale, {});
      expect(missingPaths, path).toEqual([]);
      within(text, spec, path);
    }
    within(resolveRef({}, "尺度.飞鸽"), AFFECTION_RULES.pigeon, "飞鸽增量");
    within(resolveRef({}, "尺度.私语"), WHISPER_AFFECTION_RULES, "私语增量");
    for (const [name, values] of Object.entries({ ...AFFECTION_RULES.gift, ...AFFECTION_RULES.learn })) {
      within(values.join(" "), FIELDS[FIELD.affection], name);
      within(values.join(" "), { max: AFFECTION_RULES.mvu.maxDelta }, name);
    }
  });

  it("generates silver scale from the live menu and weapon price rules", () => {
    expect(renderFieldScales([FIELD.money])).toContain(`${SERVICE_MENUS.饭馆[0].price}两`);
    expect(renderFieldScales([FIELD.money])).toContain(`${priceForQuality("weapon", "白").buyPrice}两`);
  });

  it("includes relationship and reputation scales only in a write-enabled MVU prompt", () => {
    const prompt = (narrativeOnly) => buildSysBase(200, { affection: 10 }, "", "", false, "", narrativeOnly).phiRules;
    expect(prompt(false)).toContain("好感度");
    expect(prompt(false)).toContain("威望");
    expect(prompt(true)).not.toContain(FIELDS[FIELD.reputation].scale);
    expect(prompt(false)).not.toContain("小额谢礼");
  });



  it("keeps the pigeon affection scale while whisper dropped the hidden marker", () => {
    expect(buildPrompt("pigeon.reply", {
      state: promptState(),
      letter: { npcName: "货郎阿吉" },
      preset: {},
    }).system).toContain(resolveRef({}, "尺度.飞鸽"));
    // 私语尺度已搬进 narrator_affinity 软结算的判题，旁白私聊提示词不再挂隐藏好感标记
    expect(buildNarratorWhisperContext(10)).not.toContain("⟦好感");
  });
});

describe("shared state prompt templates", () => {
  it("full engine state header carries the inner room description and exits", () => {
    expect(buildMainStatePrompt(promptState())).toBe(
      "[状态] 时间:第1日·卯初·06:00 主角:少侠〔女〕 房间:鱼定村·村口 出口:n,s NPCs:货郎阿吉〔品阶:蓝档〕〔身携:猎刀〕；在附近（本据点别处）：老猎户\n此处:村口立着一块褪色的界石，写着'曲措乡'三个字。熊曲、鹰曲、狼曲三条溪流在此交汇，水声潺潺。（四周：东·歇马居　南·鱼定商号　北·老孙饭馆　西·杂货铺摊位）\n地上物品:石子 HP:70/100 内功:3 外功:4 银两:73 七维:根骨5,悟性6 背包:刀(蓝·已装备),草药 装备:佩刀 武功:野球拳Lv2 因果:4 劫数:9\n[已触发事件] 旗\n[今日起居] 打坐1次\n[银两铁律] 玩家银两以状态值为准，正文不得虚构哭穷或摆阔；付钱、收钱、找零、结账只写系统已结算的（本轮定案签发或商店成交），系统未扣账时不得出现伙计收钱结清、掌柜找零之类情节——吃喝未结账就写赊着或未写付账，绝不让叙事与账务各说各话。\n[体感态势]\n你武功根基尚浅，气息浮浅，走急了便有些喘。\n你衣不蔽体，没什么像样的护甲傍身，身无寸铁。\n囊中尚算宽裕；眼下是清晨卯时，节气近立春。\n[在场活人]\n【货郎阿吉】此刻生活：卯时，身处鸽子笼，银囊寻常，心境郁闷，逗弄笼里的信鸽，顺手喂了一把粟米（可介入由头：手里活计正到要紧处，若非急事他不会停手，事成之后倒有兴致聊两句）；对主角相识有余、亲近不足（好感37）\n[生活常态约束] 人物此刻各有营生、吃喝、消遣与心境，不是站在原地专等主角搭话的木桩。描写其出场或回应时，须自然接住其「此刻生活」里的动作、器物、菜酒或情绪余波；除非好感甚笃或有急事，不强行中断手里活计凑上来寒暄，主角开口或凑近时再顺势接茬。",
    );
  });

  it("private-talk header uses the inner room description and filters inner-room NPCs", () => {
    expect(buildWhisperStatePrompt(promptState())).toBe(
      "[当前世界状态，仅供你了解背景，不必主动复述] 主角:少侠〔女〕 时间:第1日·卯初·06:00 房间:鱼定村·村口（村口立着一块褪色的界石，写着'曲措乡'三个字。熊曲、鹰曲、狼曲三条溪流在此交汇，水声潺潺。（四周：东·歇马居　南·鱼定商号　北·老孙饭馆　西·杂货铺摊位）） 房间里的人:货郎阿吉；在附近（本据点别处）：老猎户 玩家背包:刀(蓝·已装备)，草药",
    );
  });

  it("preserves the whisper preview except for the intended NPC visibility filter", () => {
    expect(buildWhisperStatePrompt(promptState(), { preview: true })).toBe(
      "主角:少侠〔女〕 时间:第1日·卯初·06:00 房间:鱼定村（村中喧闹） 房间里的人:货郎阿吉；在附近（本据点别处）：老猎户 玩家背包:刀(蓝·已装备)，草药",
    );
  });

  it("preserves the full prompt preview with only visible NPCs", () => {
    expect(buildMainStatePrompt(promptState(), { preview: true })).toBe(
      "时间:第1日·卯初·06:00 主角:少侠〔女〕 房间:鱼定村 出口:n,s NPCs:货郎阿吉；在附近（本据点别处）：老猎户 HP:70/100 内功:3 外功:4 银两:73 背包:刀，草药",
    );
  });

  it("reads the supplied state again after inventory and inner-room changes", () => {
    const state = promptState();
    const changed = { ...state, inv: [], innerRoomName: "别处" };
    expect(buildWhisperStatePrompt(changed, { preview: true })).toBe(
      "主角:少侠〔女〕 时间:第1日·卯初·06:00 房间:鱼定村（村中喧闹） 房间里的人:无；在附近（本据点别处）：货郎阿吉、老猎户 玩家背包:空",
    );
  });
});

describe("model-bound state refs", () => {
  it("uses the exact NPC key in a flight reply, including punctuation and spaces", () => {
    const npcName = "艾·青 山";
    const state = promptState();
    state.varTree.角色[npcName] = {
      好感度: 42, 态度: "熟稔",
      飞鸽: [{ dir: "send", content: "你好 @主角.名", gift: "竹笛" }, { dir: "reply", content: "已阅" }],
    };
    const trace = vi.fn();
    const prompt = buildPrompt("pigeon.reply", {
      state,
      letter: { npcName },
      preset: { scenario: "@不替换" },
      trace,
    }).system;
    expect(prompt.split("\n").slice(0, 6).join("\n")).toBe(
      "你是武侠世界「曲措乡」中的【艾·青 山】\n你与主角的关系：好感度 42/100，熟稔。好感越低越冷淡疏离，越高越亲近热络。\n剧本背景：@不替换\n你收到主角寄来的信。你们此前往来的信件（须前后连贯、不自相矛盾）：\n主角来信：你好 @主角.名（附礼：竹笛）\n你的回信：已阅",
    );
    expect(trace).not.toHaveBeenCalled();
  });


});
