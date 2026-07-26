import { describe, it, expect } from "vitest";
import { parseMainResponse } from "./parseResponse.js";

describe("parseMainResponse", () => {
  it("解析标准 JSON 回复", () => {
    const { p, mvuCommands, dealResult } = parseMainResponse('{"output":["行一","行二"],"memory":"测试"}');
    expect(p).toEqual({ output: ["行一", "行二"], memory: "测试" });
    expect(mvuCommands).toEqual([]);
    expect(dealResult).toBeNull();
  });

  it("抠出 MVU 块并解析剩余 JSON", () => {
    const raw = '{"output":["她收下了"]} \n<mvu>\n_.add(\'角色.八云.好感度\', 3);\n</mvu>';
    const { p, mvuCommands } = parseMainResponse(raw);
    expect(p.output).toEqual(["她收下了"]);
    expect(mvuCommands.length).toBe(1);
    expect(mvuCommands[0].path).toBe("角色.八云.好感度");
  });

  it("抠出赌石谈价 <deal> 标签", () => {
    const raw = '{"output":["成交"]} <deal>{"priceMult":1.2,"addItem":null}</deal>';
    const { p, dealResult } = parseMainResponse(raw);
    expect(p.output).toEqual(["成交"]);
    expect(dealResult).toEqual({ priceMult: 1.2, addItem: null });
  });

  it("截断救援：只救回闭合完整的行", () => {
    const raw = '{"output":["完整的一行","完整的二行","半截的三';
    const { p } = parseMainResponse(raw);
    expect(p.output).toEqual(["完整的一行", "完整的二行"]);
    expect(p._truncated).toBe(true);
  });

  it("纯文本打断拒答：不加格式异常前缀", () => {
    const raw = "旁白不想回答这个问题。";
    const { p } = parseMainResponse(raw);
    expect(p.output).toEqual(["旁白不想回答这个问题。"]);
  });

  it("畸形 JSON：保留格式异常提示与原文", () => {
    const raw = '{"output": [坏掉的';
    const { p } = parseMainResponse(raw);
    expect(p.output[0]).toContain("引擎回应格式异常");
  });

  it("空回复：兜底语塞文案", () => {
    const { p } = parseMainResponse("");
    expect(p.output[0]).toContain("旁白一时语塞");
  });
});
