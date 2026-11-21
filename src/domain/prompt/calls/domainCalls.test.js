import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetPromptRegistryForTest } from "../registry.js";
import { createMockAi } from "../../../engine/ports/ai.js";
import { withAI } from "../withAI.js";
import { buildExtractionCfg } from "../extractionEngine.js";
import { registerDomainCalls } from "./domainCalls.js";

const LEGACY_FORGE_WHITELIST = `
可选词条(effect，只能从这里选，按玩家"要求"语义匹配，白/绿档留空不给词条、蓝档起才给)：
· 攻击向：forceFirst(必先手,对应"快/先发") | ignoreDefense(无视防御,对应"锋利/破甲") | doubleVsStatus(克中招之敌翻倍) | lowHpBonus:0.15(残血增伤,对应"绝境/搏命") | afterStatusBonus(趁敌中招追击) | detonateMark:{perStackRatio:0.35}(引爆内伤)
· 控制向：enemyCostPenalty:{value:2,turns:2}(封穴抬高对方耗气) | freezeEnergyRecovery(封气,冻回气) | applyMark:{name:"内伤印",stacks:1}+applyMarkChance:0.3(附内伤印)
· 应对向：onCounterSuccessDamageRatio:0.3(应对成功追伤,对应"以守反攻") | onCounterSuccessEnergyGain:2(应对成功回气)
· 续航向：hpRestore:0.08(每回合回血,对应"养身/温养") | energyRestore:2(起手回气)
· 六维：sixDim:{气运:2}(对应"幸运") | sixDim:{身法:2}(轻便) | sixDim:{根骨:2}(坚固) | sixDim:{魅力:2} | sixDim:{智谋:1} | sixDim:{体魄:1} | sixDim:{悟性:1}
effect 与 sixDim 二选一为主(一件东西通常只挂其一，紫橙档可两者少量兼有)。`;

function buildLegacyPersuadeSystem(persuade, hitKeyIds, guard) {
  const keysDesc = persuade.keys
    .map(k => {
      const hit = hitKeyIds.includes(k.id);
      return `  - [${k.id}] ${k.hint}${hit ? "（已戳中，不重复计）" : ""}`;
    })
    .join("\n");

  return `你现在扮演【${persuade.who}】，和玩家进行一场"说服"交锋。玩家想让你让步，你有顾虑不肯松口。

你的心结（不肯让步的原因）：${persuade.knot}

【你只输出台词，绝不泄底】
你只输出【${persuade.who}】这一句话的台词，口语，不超过30个字。
- 不要写任何叙事、旁白、动作描写、神态描写、括号说明。
- 不要写"他说""掌柜道"这类引导语。直接就是这个人说出口的话。
- 就像真人对话里对方回你的一句话那么短。
- 【关键】绝不能在台词里暴露游戏机制：不许说"你说中了""还差一点""再说一条""你戳中了我的心结"这类话；不许把下面列出的突破口内容当台词念出来提示玩家。你的心结要让玩家自己从对话里揣摩，你只管以这个人的身份自然反应。

【你的立场演绎】（当前戒心 ${guard}/100，越低越松动）
- 戒心高（>60）：搪塞、推脱、打太极，话冷。
- 戒心中（30~60）：口风开始软，偶尔漏出点真心话，但嘴上还端着。
- 戒心低（<30）：几乎守不住，玩家再推一把就松口。
- 玩家没戳中要害、只是空谈或硬来时：继续挡，别松口。
- 玩家戳中顾虑/软肋、或话说得让你放下戒备时：语气动摇，但别一次答应，还要再端一端。

【玩家可能戳中的突破口】（仅供你判断，不要在台词里念出来）：
${keysDesc}

【隐藏判定】
在你这句台词的最后，另起一行，输出一个 JSON（玩家看不到，系统用）：
{"hit":"戳中的key的id或null","guardDrop":0到50的整数,"yield":true/false}
- hit：这一轮玩家的话【只要方向对、沾到某个未戳中突破口的边】就填那个 id，不要求字字精准；纯空谈、硬来、重复已戳中的，才填 null。判定宁松勿严——别让玩家说了好几轮还一个都不中。
- guardDrop：这话让你放下多少戒备。一般讲理/寒暄给 5~15；说得真诚、投机、示弱、给足好处、或说到你情绪痛点上，给 30~50；胡搅蛮缠、冒犯你，给 0。
- yield：只有当【累计戳中数 ≥ ${persuade.resistance}】且你这句是松口答应时，才 true；否则 false。
当前累计已戳中：${hitKeyIds.length} / 需要 ${persuade.resistance}。

再强调：台词一行（≤30字，纯口语），JSON 一行，不要有别的。`;
}

describe("domainCalls parity with legacy requests", () => {
  beforeEach(() => {
    resetPromptRegistryForTest();
    registerDomainCalls();
  });

  it("persuasion.turn matches legacy system, multi-turn history messages and options", async () => {
    const persuade = {
      who: "药铺掌柜",
      knot: "怕管家追责，不敢卖管控药给和山贼沾边的人",
      keys: [
        { id: "k1", hint: "点破管家走私账本上也有这家铺子", need: null },
        { id: "k2", hint: "亮出管家私心的传闻", need: "rumor_guanjia_sixin" },
        { id: "k3", hint: "抬出柳青鸢都事在查此事", need: "met_liuqingyuan" },
      ],
      resistance: 2,
    };
    const hitKeyIds = ["k1"];
    const guard = 65;
    const history = [
      { role: "assistant", content: "你要买管控的药？这药我可不敢乱卖……" },
      { role: "user", content: "管家那本私账我也见过。" },
      { role: "assistant", content: "休得胡言，我这小铺子安分守己！" },
    ];
    const playerSay = "柳青鸢@都事已在查账了，你何苦替人背锅？";
    const expectedSystem = buildLegacyPersuadeSystem(persuade, hitKeyIds, guard);
    const expectedMessages = [...history, { role: "user", content: playerSay }];

    for (const apiCfg of [{ model: "m1" }, { model: "m1", callTokenLimits: { persuasion: 2600 } }]) {
      const onRequest = vi.fn();
      const ai = createMockAi(['你少拿官府压我。\n{"hit":"k3","guardDrop":30,"yield":false}'], { onRequest });

      const res = await withAI(
        "persuasion.turn",
        { persuade, playerSay, hitKeyIds, ownedFlags: [], history, guard },
        { ai, apiCfg },
      );

      expect(res.ok).toBe(true);
      const [messages, opts] = onRequest.mock.calls[0];
      expect(opts.cfg).toBe(apiCfg);
      expect(opts.systemPrompt).toBe(expectedSystem);
      expect(messages).toEqual(expectedMessages);
      expect(opts.modelOptions).toEqual({
        maxTokens: apiCfg.callTokenLimits?.persuasion ?? 2000,
        callLabel: "说服（药铺掌柜）",
      });
    }
  });

  it("forge.design matches legacy default blacksmith and jade shop requests", async () => {
    const buildLegacyForge = ({ material, category, requirement, craft }) => {
      const maker = craft?.maker || "铁匠";
      const wares = craft?.wares || "兵器/护具/饰物";
      const shop = craft?.shop || "铁匠铺";
      const system = `你是曲措乡这个澜湄雪域武侠世界里${shop}的"匠心"——玩家拿料来定制${wares}，你这位${maker}要据玩家给的【材料/类别/要求】设计出三个不同的成品方案供他挑选。守规矩：你只负责创意(名字、属于哪类装备、挂什么词条、说书人风味的介绍)，绝不决定品质高低(那由玩家气运和料子成色定)、绝不编数值。三个方案要有区别——同样的料和要求，可以往不同形制/侧重去做。`;
      const user = `玩家定制需求：
· 材料：${material || "(未指定，任你择料)"}
· 类别：${category || "(未指定，你据材料与要求判断最合适的类别)"}
· 要求：${requirement || "(未特别要求)"}
${LEGACY_FORGE_WHITELIST}

请设计 3 个不同的成品方案，只输出 JSON，不要任何解释或 markdown：
{"candidates":[
  {"name":"贴合材料与形制的成品名(不超过7字)","category":"weapon|armor|accessory 三选一","effect":{词条对象，按白名单选，可空对象{}},"sixDim":{六维对象，可空},"desc":"一两句说书人白话古文，讲这件东西的形制/来历/脾性，禁冒号破折号"}
  , {第二个方案，与第一个形制或侧重不同}\x20
  , {第三个方案，再不同}
]}
注意：category 必须是 weapon/armor/accessory 之一的英文；effect 和 sixDim 若不给就写空对象 {}；name 要贴合材料(玩家写了陨铁/某玉料，名字里就该见其质感)。`;
      return { system, user, callLabel: `${shop}定制设计` };
    };

    const cases = [
      {
        ctx: { material: "寒铁", category: "", requirement: "锋利", craft: undefined },
        apiCfg: { apiType: "openai", model: "main-m", extractionModel: "ext-m" },
      },
      {
        ctx: {
          material: "冰种翡翠",
          category: "饰物",
          requirement: "养身护气",
          craft: { shop: "金玉行", maker: "玉匠", wares: "玉器饰物护身之物" },
        },
        apiCfg: {
          apiType: "openai",
          model: "main-m",
          extractionModels: { FORGE_DESIGN: "forge-small" },
          callTokenLimits: { extraction: 3200 },
        },
      },
    ];

    for (const { ctx, apiCfg } of cases) {
      const expected = buildLegacyForge(ctx);
      const expectedCfg = buildExtractionCfg("FORGE_DESIGN", apiCfg);
      const onRequest = vi.fn();
      const ai = createMockAi(['{"candidates":[]}'], { onRequest });

      await withAI(
        "forge.design",
        { ...ctx, forgeCfg: buildExtractionCfg("FORGE_DESIGN", apiCfg) },
        { ai, apiCfg },
      );

      const [messages, opts] = onRequest.mock.calls[0];
      expect(opts.cfg).toEqual(expectedCfg);
      expect(opts.systemPrompt).toBe(expected.system);
      expect(messages).toEqual([{ role: "user", content: expected.user }]);
      expect(opts.modelOptions).toEqual({
        maxTokens: apiCfg.callTokenLimits?.extraction ?? 2000,
        callLabel: expected.callLabel,
      });
    }
  });
});
