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
          required: ["kind", "target", "itemId", "direction", "stance"],
          properties: {
            kind: { type: "string", enum: ["talk", "move", "inspect_container", "take", "give", "trade", "steal", "duel", "appease", "learn", "invite", "use_item", "equip", "free_act"] },
            target: { type: "string" },
            itemId: { type: "string" },
            direction: { type: "string", enum: ["n", "s", "e", "w", "none"] },
            stance: { type: "string", enum: ["sincere", "clever", "forceful", "casual", "perfunctory"] },
          },
        },
      },
      proposals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["claim", "kind", "fit"],
          properties: {
            claim: { type: "string", description: "玩家声称找到或促成的具体事物，如桌上有本剑谱" },
            kind: { type: "string", enum: ["find_item", "secret_clue", "social_deal", "environment_use"] },
            fit: { type: "string", enum: ["natural", "stretch", "absurd"] },
          },
        },
      },
    },
  },
};
