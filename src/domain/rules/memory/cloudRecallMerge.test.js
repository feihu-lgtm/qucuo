// WO-20C 云端原文召回合并纯函数测试
import { describe, it, expect } from "vitest";
import { cloudHitToEntry, mergeCloudProseEntries, normalizeProseText } from "./cloudRecallMerge.js";

function mkHit(over = {}) {
  return {
    chunkId: "b1::P12_3",
    turn: 12,
    location: "曲措乡",
    witnesses: ["*"],
    entities: [],
    rawText: "云端藏刀旧事原文。",
    publicText: "云端藏刀旧事原文。",
    seq: 3,
    branchId: "b1",
    score: 2.5,
    neighbors: [],
    ...over,
  };
}

describe("cloudHitToEntry 映射", () => {
  it("正常映射成 recallProse 形状，importance 缺省 1", () => {
    const e = cloudHitToEntry(mkHit(), "主角");
    expect(e.turn).toBe(12);
    expect(e.text).toBe("云端藏刀旧事原文。");
    expect(e.importance).toBe(1);
    expect(e.ids).toEqual(["b1::P12_3"]);
  });
  it("witnesses 不含 viewer 或 * 的块客户端再滤丢弃（不信任服务端）", () => {
    expect(cloudHitToEntry(mkHit({ witnesses: ["老孙"] }), "主角")).toBeNull();
    expect(cloudHitToEntry(mkHit({ witnesses: ["主角"] }), "主角")).not.toBeNull();
    expect(cloudHitToEntry(mkHit({ witnesses: ["主角"] }), "")).toBeNull(); // 空 viewer 只看公共
  });
  it("坏形状（无 chunkId/turn）返回 null", () => {
    expect(cloudHitToEntry(mkHit({ chunkId: "" }), "主角")).toBeNull();
    expect(cloudHitToEntry(mkHit({ turn: "12" }), "主角")).toBeNull();
    expect(cloudHitToEntry(null, "主角")).toBeNull();
  });
  it("rawText 按当前 viewer 现剥心理", () => {
    // 斜体第三人称心理（契约格式 *他心想…*）：非视角人剥除，视角人保留
    const hit = mkHit({ rawText: "他拔出刀。*他心想此人不可信*众人皆惊。" });
    const e = cloudHitToEntry(hit, "主角");
    expect(e.text).not.toContain("他心想");
    expect(e.text).toContain("他拔出刀");
    expect(e.text).toContain("众人皆惊");
  });
  it("邻段按 seq 排序拼块且邻段也过 viewer 过滤", () => {
    const hit = mkHit({
      neighbors: [
        { chunkId: "n2", turn: 12, witnesses: ["*"], rawText: "后段。", seq: 4 },
        { chunkId: "n0", turn: 12, witnesses: ["*"], rawText: "前段。", seq: 2 },
        { chunkId: "nx", turn: 12, witnesses: ["别人"], rawText: "私密段。", seq: 5 },
      ],
    });
    const e = cloudHitToEntry(hit, "主角");
    expect(e.text).toBe("前段。\n云端藏刀旧事原文。\n后段。");
    expect(e.text).not.toContain("私密段");
  });
});

describe("mergeCloudProseEntries 合并", () => {
  const localEntry = { ids: ["P12_3"], turn: 12, text: "云端藏刀旧事原文。", witnesses: ["*"], importance: 2, anchorScore: 9 };
  it("同段云/本地不同 id 不重复（turn+规范化文本去重）", () => {
    const out = mergeCloudProseEntries([localEntry], [mkHit()], { viewer: "主角", topK: 5 });
    expect(out).toHaveLength(1);
    expect(out[0].ids).toEqual(["P12_3"]); // 本地权威保留
  });
  it("云端补齐本地没有的段，本地在前云端在后", () => {
    const cloudOnly = mkHit({ chunkId: "b1::P30_1", turn: 30, rawText: "跨设备同步的旧事。" });
    const out = mergeCloudProseEntries([localEntry], [cloudOnly], { viewer: "主角", topK: 5 });
    expect(out).toHaveLength(2);
    expect(out[0].turn).toBe(12); // 本地在前
    expect(out[1].turn).toBe(30);
  });
  it("空白差异视为同段（规范化去重）", () => {
    expect(normalizeProseText(" 甲 乙\n")).toBe("甲乙");
    const hit = mkHit({ rawText: "云端藏刀旧事 原文。" }); // 多空格
    const local2 = { ...localEntry, text: "云端藏刀旧事原文。" };
    const out = mergeCloudProseEntries([local2], [hit], { viewer: "主角", topK: 5 });
    expect(out).toHaveLength(1);
  });
  it("云端条目部分段落与本地重复时只剥重复段，其余保留", () => {
    const hit = mkHit({
      rawText: "云端藏刀旧事原文。",
      neighbors: [{ chunkId: "n4", turn: 12, witnesses: ["*"], rawText: "本地没有的后段。", seq: 4 }],
    });
    const out = mergeCloudProseEntries([localEntry], [hit], { viewer: "主角", topK: 5 });
    expect(out).toHaveLength(2);
    expect(out[1].text).toBe("本地没有的后段。");
  });
  it("topK 总条数封顶：本地已占满时云补被裁", () => {
    const locals = [1, 2, 3].map((i) => ({ ...localEntry, turn: i, text: `本地段${i}。`, ids: [`L${i}`] }));
    const out = mergeCloudProseEntries(locals, [mkHit({ turn: 99, rawText: "云段。" })], { viewer: "主角", topK: 3 });
    expect(out).toHaveLength(3);
    expect(out.every((e) => e.ids[0].startsWith("L"))).toBe(true);
  });
  it("锚段与邻段同文本时块内重复段只留一份（Review 修）", () => {
    const hit = mkHit({
      rawText: "相同的段落。",
      neighbors: [{ chunkId: "n1", turn: 12, witnesses: ["*"], rawText: "相同的段落。", seq: 4 }],
    });
    const out = mergeCloudProseEntries([], [hit], { viewer: "主角", topK: 5 });
    expect(out).toHaveLength(1);
    expect(out[0].text.split("相同的段落。").length - 1).toBe(1);
  });

  it("云端互去重：两条相同文本只留一条", () => {
    const h1 = mkHit({ chunkId: "c1" });
    const h2 = mkHit({ chunkId: "c2" });
    const out = mergeCloudProseEntries([], [h1, h2], { viewer: "主角", topK: 5 });
    expect(out).toHaveLength(1);
  });
});
