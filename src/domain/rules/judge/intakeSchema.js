// WO-12 契约 B：前哨听意 IntakeSchema（专为轻量小模型设计的扁平结构，冻结契约严禁自造字段）。
// 严格单层对象加浅数组，键序固定 read 在最前（替代慢思考链）；
// 所有候选 ID 由系统现场喂入，小模型只做选择与档位打分。
export const INTAKE_JSON_SCHEMA = {
  name: "turn_intake",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["read", "refIds", "actions", "proposals"],
    properties: {
      read: { type: "string", description: "不超过 40 字，指明玩家话中代词指谁、意图核心是什么" },
      refIds: { type: "array", items: { type: "string" }, description: "玩家提及的场记板条目 ID，无则空数组" },
      actions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          // WO-16G PR-G1：12 字段全 required（OpenAI strict 口径，禁联合类型），
          // 缺省语义 空串/none/无/0——outcome/risk 只进 schema 与喂料，
          // 判官消费在 WO-16F 接，risk 已被 budgetInput 兼容读取。
          required: ["kind", "target", "item", "itemId", "direction", "condition", "condition_text", "stance", "outcome", "risk", "confidence", "text"],
          properties: {
            kind: { type: "string", enum: ["talk", "move", "inspect_container", "take", "give", "trade", "steal", "duel", "appease", "learn", "invite", "use_item", "equip", "free_act"] },
            target: { type: "string", description: "在场角色或容器的准确名字，没点名或不在场填「无」" },
            item: { type: "string", description: "物件名从清单里选；选不出填「无」" },
            itemId: { type: "string", description: "清单括号里的编号；选不出填空串" },
            direction: { type: "string", enum: ["n", "s", "e", "w", "none"] },
            condition: { type: "string", enum: ["无", "遇敌", "到达", "被拒", "其他"], description: "玩家说了「要是/如果/若/万一……就」前提时选类，没有填「无」" },
            condition_text: { type: "string", description: "前提原文照抄；没有前提填空串" },
            stance: { type: "string", enum: ["sincere", "clever", "forceful", "casual", "perfunctory"] },
            outcome: { type: "string", enum: ["无", "伤损", "得财", "破费", "调息", "修习", "服用", "受寒中毒", "醉酒", "其他"], description: "按常理最可能的后果，不估数值；拿不准选「无」" },
            risk: { type: "string", enum: ["无", "低", "中", "高"], description: "动作本身有多险；闲谈赶路选「无」" },
            confidence: { type: "number", minimum: 0, maximum: 1, description: "0 到 1；十拿九稳才给 0.95 以上" },
            text: { type: "string", description: "抄玩家原话对应那段，一字不改；只有一个动作抄整句" },
          },
        },
      },
      proposals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          // strict 结构化输出要求全字段 required——非 quest_advance 的提议一律填空串，
          // 空串视同未填（白名单自然拒收，judge/normalize 语义一致）。
          required: ["claim", "kind", "fit", "questId", "flag"],
          properties: {
            claim: { type: "string", description: "玩家声称找到或促成的具体事物，如桌上有本剑谱" },
            kind: { type: "string", enum: ["find_item", "secret_clue", "social_deal", "environment_use", "quest_advance"] },
            fit: { type: "string", enum: ["natural", "stretch", "absurd"] },
            // quest_advance 专用：只能抄系统喂入的候选 questId/flag，自编一律被白名单拒收；
            // 非 quest_advance 提议必须填空串
            questId: { type: "string" },
            flag: { type: "string" },
          },
        },
      },
    },
  },
};
