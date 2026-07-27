import { describe, it, expect } from "vitest";
import { isCompatibleCharShape, isCompatibleRoomShape } from "./saves.js";

// 这个测试的存在意义：这两个判定曾经是 saves.js 的模块私有函数，而 MudRPG.jsx
// 的 applySnapshot（手动读槽位 + ↩回滚）直接裸调用它们——既没 export 也没 import，
// 一点就 ReferenceError，读档和回滚两个入口全废，而且因为没有任何测试覆盖，
// 静默坏了很久没人发现。现在改成 export，这里钉死"必须可从外部导入且行为正确"。

describe("存档结构兼容判定（必须保持 export，MudRPG.applySnapshot 依赖）", () => {
  it("两个判定都能从 saves.js 导入", () => {
    expect(typeof isCompatibleCharShape).toBe("function");
    expect(typeof isCompatibleRoomShape).toBe("function");
  });

  const goodChar = { hp: [100, 100], neigong: 3, waigong: 2, special: { 气运: 5 } };
  const goodRoom = { name: "曲措乡", desc: "一片高原河谷", exits: [], npcs: [], items: [] };

  it("完整的新版 char 判为兼容", () => {
    expect(isCompatibleCharShape(goodChar)).toBe(true);
  });

  it("完整的新版 room 判为兼容", () => {
    expect(isCompatibleRoomShape(goodRoom)).toBe(true);
  });

  it("空值判为不兼容，不抛错", () => {
    for (const v of [null, undefined, 0, "", {}]) {
      expect(isCompatibleCharShape(v)).toBeFalsy();
      expect(isCompatibleRoomShape(v)).toBeFalsy();
    }
  });

  it("老存档缺 neigong/waigong/special 判为不兼容", () => {
    expect(isCompatibleCharShape({ ...goodChar, neigong: undefined })).toBeFalsy();
    expect(isCompatibleCharShape({ ...goodChar, waigong: undefined })).toBeFalsy();
    expect(isCompatibleCharShape({ ...goodChar, special: undefined })).toBeFalsy();
  });

  it("hp 必须是数组（老档存成数字的情况）", () => {
    expect(isCompatibleCharShape({ ...goodChar, hp: 100 })).toBeFalsy();
  });

  it("room 缺 exits/npcs/items 任一数组即判不兼容", () => {
    expect(isCompatibleRoomShape({ ...goodRoom, exits: undefined })).toBeFalsy();
    expect(isCompatibleRoomShape({ ...goodRoom, npcs: undefined })).toBeFalsy();
    expect(isCompatibleRoomShape({ ...goodRoom, items: undefined })).toBeFalsy();
  });

  it("room 的 name/desc 必须是字符串", () => {
    expect(isCompatibleRoomShape({ ...goodRoom, name: 123 })).toBeFalsy();
    expect(isCompatibleRoomShape({ ...goodRoom, desc: null })).toBeFalsy();
  });
});
