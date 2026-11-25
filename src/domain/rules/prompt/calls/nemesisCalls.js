// ── WO-23C1 宿敌赐号 prompt 注册（系统定事实，AI 只起名）────────────────────
// 输入只给 deterministic facts：name/faction/tier/baseRole/origin/scars/grudge——
// 不给模型编事实的权限；schema 结构化输出三字段，校验不合格由 epithetCheck 拒写。
import { definePrompt } from "../registry.js";

export function registerNemesisCalls() {
  definePrompt("block", "nemesis.epithet.sys", {
    label: "宿敌赐号系统指令",
    slot: "sys",
    text: (ctx) => {
      const e = ctx.nemesis || {};
      const scars = Array.isArray(e.scars) && e.scars.length
        ? e.scars.map((s) => `${s.kind}${s.note ? `（${s.note}）` : ""}`).join("、")
        : "无";
      const origin = e.origin?.summary || "无录";
      return `你是武侠世界的江湖百晓生，专管给成名人物起绰号。
对象：${e.name}，${e.faction}第${e.tier}阶人物，本是${e.baseRole || "无名之辈"}。
结仇原委：${origin}
身上旧伤：${scars}
与主角结仇强度：${e.grudge >= 5 ? "不共戴天" : e.grudge >= 3 ? "结怨已深" : "小有嫌隙"}

为他起三样东西，全部用中文白话古文风格：
① epithet：绰号，2-8 个汉字，要贴合此人的来路、伤势或性情，不许带数字英文，不许带玩家名字，不许脏字；
② tauntLine：他再遇主角时的一句狠话，不超过 40 字，只能放狠不得声称已经赢过主角；
③ rumorSnippet：茶馆里关于此人的一句传闻，不超过 60 字，只能渲染仇恨与来头，不得编造他击败主角之类的战绩。
你只负责起名与措辞——他的品阶、伤势、仇怨深浅都是既定事实，不许在文字里改写。`;
    },
  });

  definePrompt("block", "nemesis.epithet.user", {
    label: "宿敌赐号请求",
    slot: "user",
    text: (ctx) => `为【${ctx.nemesis?.name || "此人"}】起绰号、狠话、传闻三样。`,
  });

  definePrompt("call", "nemesis.epithet", {
    group: "async",
    label: "宿敌赐号",
    execution: "async_background",
    route: "primary",
    reviewDesc: "只起名不定事实；epithetCheck 校验不过静默弃用不写账",
    tokenLimitKey: "nemesisEpithet",
    defaultMaxTokens: 600,
    join: "",
    blocks: ["nemesis.epithet.sys", "nemesis.epithet.user"],
    schema: {
      type: "object",
      properties: {
        epithet: { type: "string" },
        tauntLine: { type: "string" },
        rumorSnippet: { type: "string" },
      },
      required: ["epithet", "tauntLine", "rumorSnippet"],
      additionalProperties: false,
    },
  });
}

registerNemesisCalls();
