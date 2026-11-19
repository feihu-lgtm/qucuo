import { describe, it, expect } from "vitest";
import { cleanJsonString } from "./apiConfig.js";

describe("cleanJsonString", () => {
  it("字符串内的中文引号是合法内容：保留且解析成功（兽骨事故回归）", () => {
    // 提取层真实返回：desc 里 写着“天都”二字 的中文引号是内容，不是定界符。
    // 此前无差别转成英文引号 → 未配对 → JSON.parse 必挂 → 整份提取作废。
    const raw = `{
  "room": {
    "name": "天都镇",
    "desc": "一座喧闹繁荣的市镇，镇口立有写着“天都”二字的木牌坊。街道两侧店铺林立，酒旗招展。",
    "exits": ["w"],
    "npcs": [],
    "items": []
  },
  "delta": {
    "items_add": [
      { "name": "深紫色兽骨", "quality": "紫", "category": "misc" }
    ]
  },
  "memory": "陈狐飞途经泥沼获得深紫色兽骨，随后抵达天都镇。"
}`;
    const parsed = JSON.parse(cleanJsonString(raw));
    expect(parsed.room.name).toBe("天都镇");
    expect(parsed.room.desc).toContain("“天都”");
    expect(parsed.delta.items_add[0].name).toBe("深紫色兽骨");
  });

  it("结构性中文引号（模型用 “” 当定界符）：转换挽救", () => {
    const raw = `{“name”: “天都镇”, “exits”: [“w”]}`;
    const parsed = JSON.parse(cleanJsonString(raw));
    expect(parsed).toEqual({ name: "天都镇", exits: ["w"] });
  });

  it("结构性与内容中文引号混排：各归各位", () => {
    const raw = `{“desc”: “他说“好”然后走了”}`;
    const parsed = JSON.parse(cleanJsonString(raw));
    expect(parsed.desc).toBe("他说“好”然后走了");
  });

  it("既有容错：尾逗号 / 未闭合括号 / 中文冒号", () => {
    expect(JSON.parse(cleanJsonString(`{"a":1,}`))).toEqual({ a: 1 });
    expect(JSON.parse(cleanJsonString(`{"a":[1,2`))).toEqual({ a: [1, 2] });
    expect(JSON.parse(cleanJsonString(`{"a"：1}`))).toEqual({ a: 1 });
  });

  it("转义引号不被误判为字符串结束", () => {
    const raw = `{"a":"他说\\"早\\"然后走了","b":2}`;
    expect(JSON.parse(cleanJsonString(raw))).toEqual({ a: '他说"早"然后走了', b: 2 });
  });
});
