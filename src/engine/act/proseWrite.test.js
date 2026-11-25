import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { writeTurnProse } from "./proseWrite.js";
import { getAllProseChunks, countProseChunks, addProseChunks } from "../../infra/proseStore.js";
import { _resetMemoryDbForTest } from "../../infra/memoryDb.js";

describe("writeTurnProse — 原文段落写挂", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    _resetMemoryDbForTest();
  });

  const flush = () => new Promise((r) => setTimeout(r, 30));

  it("普通回合 witnesses = 玩家+在场 NPC，锚点剥入 anchorFactIds", async () => {
    writeTurnProse({
      narrativeText: "你走进铁匠铺。\n赫连铸抬头看了你一眼。⟦F12_1⟧",
      turn: 12, location: "铁匠铺", playerName: "主角",
      roomNpcNames: ["赫连铸"], anchoredFacts: ["F12_1"], addChunks: addProseChunks,
    });
    await flush();
    const all = await getAllProseChunks();
    expect(all.length).toBe(2);
    expect(all[0].witnesses).toEqual(["主角", "赫连铸"]);
    expect(all[0].location).toBe("铁匠铺");
    const anchored = all.find((c) => c.anchorFactIds.length);
    expect(anchored.anchorFactIds).toContain("F12_1");
    expect(anchored.rawText).not.toContain("⟦");
  });

  it("私聊搭话回合 witnesses 只含玩家+对象（防串味）", async () => {
    writeTurnProse({
      narrativeText: "你低声问她旧事。",
      turn: 3, location: "后院", playerName: "主角",
      roomNpcNames: ["路人甲", "慕轻烟"],
      isTalk: true, talkTarget: "慕轻烟", addChunks: addProseChunks,
    });
    await flush();
    const all = await getAllProseChunks();
    expect(all[0].witnesses).toEqual(["主角", "慕轻烟"]);
  });

  it("存档代次护栏触发时零写入", async () => {
    writeTurnProse({
      narrativeText: "一段正文", turn: 3, location: "x", playerName: "主角",
      guard: () => true, addChunks: addProseChunks,
    });
    await flush();
    expect(await countProseChunks()).toBe(0);
  });

  it("空正文/非法回合零写入且不抛错", async () => {
    writeTurnProse({ narrativeText: "", turn: 3, location: "x", playerName: "主角", addChunks: addProseChunks });
    writeTurnProse({ narrativeText: "正文", turn: 0, location: "x", playerName: "主角", addChunks: addProseChunks });
    writeTurnProse(null);
    await flush();
    expect(await countProseChunks()).toBe(0);
  });
});
