import { describe, expect, it, vi } from "vitest";
import {
  buildMainStatePrompt,
  buildWhisperStatePrompt,
  renderPromptTemplate,
  resolveRef,
} from "./promptRefs.js";
import { buildPigeonPrompt } from "./pigeonPrompt.js";
import { callExtraction } from "./extractionEngine.js";

function promptState() {
  return {
    char: {
      name: "少侠", gender: "女", hp: [70, 100], neigong: 3, waigong: 4,
      special: { 根骨: 5, 悟性: 6 },
    },
    inv: [{ name: "刀", quality: "蓝", equipped: true }, "草药"],
    skills: [{ name: "野球拳", level: 2 }],
    dao: { karma: 4, jie: 9 },
    flags: ["旗"],
    time: 6,
    getTimeStr: () => "第1日·卯初·06:00",
    room: {
      name: "鱼定村", desc: "村中喧闹", exits: ["n", "s"], items: [{ name: "石子" }],
      npcs: [
        { name: "才旦", innerRoom: "村口", levelCap: 2, carriedItems: [{ name: "猎刀" }] },
        { name: "老猎户", innerRoom: "别处" },
      ],
    },
    innerRoomName: "村口",
    quality: ["白", "绿", "蓝", "紫", "橙", "红"],
    describeEquipment: () => "佩刀",
    describeTodayForAI: () => "\n[今日起居] 打坐1次",
    varTree: { 角色: { 才旦: { 好感度: 37, 态度: "爽朗" } } },
  };
}

describe("prompt reference resolver", () => {
  it("resolves direct, nested, and named derived fields", () => {
    const state = promptState();
    expect(resolveRef(state, "room.name")).toBe("鱼定村");
    expect(resolveRef(state, "char.hp")).toEqual([70, 100]);
    expect(resolveRef(state, "主角.名")).toBe("少侠");
    expect(resolveRef(state, "varTree.角色.才旦.好感度")).toBe(37);
    expect(renderPromptTemplate("@气血 / @varTree.角色.才旦.好感度", state).text).toBe("70/100 / 37");
  });

  it("preserves ASCII combat refs before Han suffixes and does not reparse resolved text", () => {
    expect(renderPromptTemplate("第@round.round回合：@{room.name}后 @narrative", {
      ...promptState(), round: { round: 3 }, narrative: "@missing",
    })).toEqual({ text: "第3回合：鱼定村后 @missing", missingPaths: [] });
  });

  it("renders a missing path empty and reports it once to the trace callback", () => {
    const trace = vi.fn();
    const result = renderPromptTemplate(
      "@room.name @missing.value @missing.value",
      promptState(),
      { trace },
    );
    expect(result).toEqual({
      text: "鱼定村  ",
      missingPaths: ["missing.value"],
    });
    expect(trace).toHaveBeenCalledWith(["missing.value"]);
  });
});

describe("shared state prompt templates", () => {
  it("preserves the full engine state header", () => {
    expect(buildMainStatePrompt(promptState())).toBe(
      "[状态] 时间:第1日·卯初·06:00 主角:少侠〔女〕 房间:鱼定村·村口 出口:n,s NPCs:才旦〔品阶:蓝档〕〔身携:猎刀〕 物品:石子 HP:70/100 内功:3 外功:4 七维:根骨5,悟性6 背包:刀(蓝·已装备),草药 装备:佩刀 武功:野球拳Lv2 因果:4 劫数:9\n[已触发事件] 旗\n[今日起居] 打坐1次",
    );
  });

  it("preserves the private-talk header and filters inner-room NPCs", () => {
    expect(buildWhisperStatePrompt(promptState())).toBe(
      "[当前世界状态，仅供你了解背景，不必主动复述] 主角:少侠〔女〕 时间:第1日·卯初·06:00 房间:鱼定村·村口（村中喧闹） 房间里的人:才旦 玩家背包:刀(蓝·已装备)，草药",
    );
  });

  it("preserves the whisper preview except for the intended NPC visibility filter", () => {
    expect(buildWhisperStatePrompt(promptState(), { preview: true })).toBe(
      "主角:少侠〔女〕 时间:第1日·卯初·06:00 房间:鱼定村（村中喧闹） 房间里的人:才旦 玩家背包:刀(蓝·已装备)，草药",
    );
  });

  it("preserves the full prompt preview with only visible NPCs", () => {
    expect(buildMainStatePrompt(promptState(), { preview: true })).toBe(
      "时间:第1日·卯初·06:00 主角:少侠〔女〕 房间:鱼定村 出口:n,s NPCs:才旦 HP:70/100 内功:3 外功:4 背包:刀，草药",
    );
  });

  it("reads the supplied state again after inventory and inner-room changes", () => {
    const state = promptState();
    const changed = { ...state, inv: [], innerRoomName: "别处" };
    expect(buildWhisperStatePrompt(changed, { preview: true })).toBe(
      "主角:少侠〔女〕 时间:第1日·卯初·06:00 房间:鱼定村（村中喧闹） 房间里的人:无 玩家背包:空",
    );
  });
});

describe("model-bound state refs", () => {
  it("uses the exact NPC key in a flight reply, including punctuation and spaces", () => {
    const npcName = "艾·青 山";
    const state = promptState();
    state.varTree.角色[npcName] = {
      好感度: 42, 态度: "熟稔",
      飞鸽: [{ dir: "send", content: "你好 @主角.名", gift: "竹笛" }, { dir: "reply", content: "已阅" }],
    };
    const trace = vi.fn();
    const prompt = buildPigeonPrompt(state, { npcName }, { scenario: "@不替换" }, trace);
    expect(prompt.split("\n").slice(0, 6).join("\n")).toBe(
      "你是武侠世界「曲措乡」中的【艾·青 山】\n你与主角的关系：好感度 42/100，熟稔。好感越低越冷淡疏离，越高越亲近热络。\n剧本背景：@不替换\n你收到主角寄来的信。你们此前往来的信件（须前后连贯、不自相矛盾）：\n主角来信：你好 @主角.名（附礼：竹笛）\n你的回信：已阅",
    );
    expect(trace).not.toHaveBeenCalled();
  });

  it.each([
    ["LOOK", '当前场景：鱼定村，NPCs：才旦、老猎户，物品：石子\n出口固定（不能改变）：[n,s]'],
    ["EXPLORE_ACTION", "当前场景：鱼定村，背包：刀，草药"],
    ["COMBAT", "当前状态：HP=70/100，背包：刀，草药"],
    ["UNKNOWN", '当前状态：场景=鱼定村，HP=70/100，背包=刀，草药，NPC 关系={"才旦":{"好感度":37,"态度":"爽朗"}}'],
    ["TALK_CASUAL", '当前 NPC 关系：{"才旦":{"好感度":37,"态度":"爽朗"}}\n在场人物与其随身之物：\n· 才旦〔身携:猎刀〕\n· 老猎户〔身无长物〕\n玩家背包：刀，草药'],
    ["MOVE", "玩家到达新地点：山门（由系统固定，不能修改）\n固定出口：[w]（不能修改）"],
  ])("%s preserves its state prefix and duel visibility constraint", async (intent, header) => {
    const chat = vi.fn(async () => ({ text: "{}" }));
    const trace = vi.fn();
    await callExtraction(intent, "这里有 @missing 和 @背包", {
      ...promptState(), lockedDestName: "山门", lockedExits: { w: "鱼定村" },
    }, {}, null, { chat }, trace);
    const [{ content }] = chat.mock.calls[0][0];
    expect(content).toContain(header + "\n\n叙事内容：\n这里有 @missing 和 @背包");
    expect(content).toContain("本轮在场 NPC 仅限：才旦。");
    expect(trace).not.toHaveBeenCalled();
  });
});
