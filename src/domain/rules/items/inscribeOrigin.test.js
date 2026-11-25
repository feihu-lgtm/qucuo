// WO-23D3 铭文来历合规精确召回契约测试
import { describe, expect, it } from "vitest";
import { findInscriptionOrigin } from "./inscribeOrigin.js";

const LINEAGE = [
  { b: "bRoot", upTo: 10 },   // 弃坑分支（截断于 turn10）
  { b: "bHead", upTo: null }, // 当前头分支
];
const VIEWER = "阿部";

function chunk(overrides) {
  return { id: "P1_1", turn: 5, seq: 1, branchId: "bHead", witnesses: ["*"], rawText: "", publicText: "", ...overrides };
}

describe("findInscriptionOrigin 合规口径", () => {
  it("当前分支可见且含器物名才取；获得段优先+最早", () => {
    const chunks = [
      chunk({ id: "P8_1", turn: 8, rawText: "又提起青钢剑试了试锋。", publicText: "x" }),
      chunk({ id: "P4_1", turn: 4, rawText: "铁匠把青钢剑塞给你，说善自珍重。", publicText: "x" }),
    ];
    const out = findInscriptionOrigin(chunks, { itemName: "青钢剑", viewer: VIEWER, currentTurn: 20, lineage: LINEAGE });
    expect(out).toContain("塞给你"); // 获得段优先于普通提及
  });

  it("别分支（弃坑时间线）段不取", () => {
    const chunks = [
      chunk({ branchId: "bRoot", turn: 6, rawText: "弃坑线里青钢剑赠予你的往事。" }),
    ];
    // bRoot upTo=10 可见turn<=10 的段——等等，这是谱系内可见分支！真正弃坑的是不在谱系里的分支
    const out1 = findInscriptionOrigin(chunks, { itemName: "青钢剑", viewer: VIEWER, currentTurn: 20, lineage: LINEAGE });
    expect(out1).toContain("青钢剑"); // 谱系内截断分支的过去段是合法可见记忆
    // 不在谱系里的野分支（串档/废支）绝不取
    const stray = [chunk({ branchId: "bStray", turn: 6, rawText: "陌生线里青钢剑。" })];
    expect(findInscriptionOrigin(stray, { itemName: "青钢剑", viewer: VIEWER, currentTurn: 20, lineage: LINEAGE })).toBe("");
  });

  it("未来段（turn 越当前/超 upTo）不取", () => {
    const chunks = [
      chunk({ turn: 25, rawText: "未来你拿起青钢剑。" }), // turn>currentTurn
      chunk({ branchId: "bRoot", turn: 12, rawText: "截断点之后青钢剑。" }), // bRoot upTo=10
    ];
    expect(findInscriptionOrigin(chunks, { itemName: "青钢剑", viewer: VIEWER, currentTurn: 20, lineage: LINEAGE })).toBe("");
  });

  it("witnesses 不含主角/非公共不取", () => {
    const chunks = [
      chunk({ witnesses: ["龙汐月"], rawText: "龙汐月私下提起青钢剑。" }),
    ];
    expect(findInscriptionOrigin(chunks, { itemName: "青钢剑", viewer: VIEWER, currentTurn: 20, lineage: LINEAGE })).toBe("");
    // 主角在场见证可取
    const mine = [chunk({ witnesses: [VIEWER, "龙汐月"], rawText: "龙汐月把青钢剑递给你看。" })];
    expect(findInscriptionOrigin(mine, { itemName: "青钢剑", viewer: VIEWER, currentTurn: 20, lineage: LINEAGE })).toContain("青钢剑");
  });

  it("rawText 心理按 viewer 剥掉", () => {
    // proseChunker 心理标记斜体——剥他人/自己心理后的文本才喂 AI
    const chunks = [
      chunk({ rawText: "你接过青钢剑。*他心想这下糟了*剑身微凉。" }),
    ];
    const out = findInscriptionOrigin(chunks, { itemName: "青钢剑", viewer: VIEWER, currentTurn: 20, lineage: LINEAGE });
    expect(out).toContain("青钢剑");
    expect(out).not.toContain("他心想");
  });

  it("无命中传空；输入 chunks 不原地改", () => {
    expect(findInscriptionOrigin([], { itemName: "青钢剑", viewer: VIEWER, currentTurn: 1, lineage: LINEAGE })).toBe("");
    expect(findInscriptionOrigin([chunk({ rawText: "没有那件兵器。" })], { itemName: "青钢剑", viewer: VIEWER, currentTurn: 20, lineage: LINEAGE })).toBe("");
    const frozen = Object.freeze([chunk({ rawText: "青钢剑送你。" })]);
    expect(findInscriptionOrigin(frozen, { itemName: "青钢剑", viewer: VIEWER, currentTurn: 20, lineage: LINEAGE })).toContain("青钢剑");
  });
});
