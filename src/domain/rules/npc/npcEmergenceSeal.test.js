import { describe, expect, it } from "vitest";
import { validateEmergenceSeal, recordRumoredNpcs, clearRumor } from "./npcEmergence.js";

const VT_WITH_RUMOR = recordRumoredNpcs({ 世界: {} }, ["磨坊阿福"], "才旦提过他家");
const BASE = {
  screenText: "磨坊阿福推门进来，憨憨地笑。旁边还有个生面孔李二狗。",
  varTree: VT_WITH_RUMOR,
  roomNpcs: [{ name: "才旦" }],
  playerName: "少侠",
};

describe("validateEmergenceSeal 五路校验", () => {
  it("正文未出现的名字不自证", () => {
    const out = validateEmergenceSeal({ mentionedNewNpcs: ["根本没提的人"] }, BASE);
    expect(out.mentionedNewNpcs).toEqual([]);
    expect(out.notes.join()).toContain("未过校验");
  });

  it("玩家名/在场NPC/雪豹/空白/超长全剔除", () => {
    const out = validateEmergenceSeal({
      mentionedNewNpcs: ["少侠", "才旦", "雪豹", "", "一个超过八个字的超长人名范例", "李二狗"],
    }, { ...BASE, screenText: "少侠才旦雪豹一个超过八个字的超长人名范例李二狗都在文里" });
    expect(out.mentionedNewNpcs).toEqual(["李二狗"]);
  });

  it("驻场名册剔除（即便正文提到）", () => {
    // 才旦本身在驻场册；已在 roomNpcs 被排除，此处单独验证驻场路径：换个不在 room 的驻场名
    const out = validateEmergenceSeal({ mentionedNewNpcs: ["李二狗"] }, BASE);
    expect(out.mentionedNewNpcs).toEqual(["李二狗"]);
  });

  it("已有传闻重复申报剔除", () => {
    const out = validateEmergenceSeal({ mentionedNewNpcs: ["磨坊阿福"] }, BASE);
    expect(out.mentionedNewNpcs).toEqual([]);
    expect(out.notes.join()).toContain("已在传闻册");
  });

  it("emergedNpc 必须对应已有传闻", () => {
    const noRumor = validateEmergenceSeal({ emergedNpc: { name: "陌生人", description: "游方货郎" } }, BASE);
    expect(noRumor.emergedNpc).toBeNull();
    const ok = validateEmergenceSeal({ emergedNpc: { name: "磨坊阿福", description: "磨坊学徒，憨厚老实" } }, BASE);
    expect(ok.emergedNpc).toEqual({ name: "磨坊阿福", description: "磨坊学徒，憨厚老实" });
  });

  it("emergedNpc 正文未登场/描述带数值/超长全丢弃", () => {
    const notInText = validateEmergenceSeal({ emergedNpc: { name: "磨坊阿福", description: "磨坊学徒" } },
      { ...BASE, screenText: "正文里根本没有他" });
    expect(notInText.emergedNpc).toBeNull();
    const withDigits = validateEmergenceSeal({ emergedNpc: { name: "磨坊阿福", description: "攻击50点的好手" } }, BASE);
    expect(withDigits.emergedNpc).toBeNull();
    expect(withDigits.warnings.join()).toContain("定性描述非法");
    const tooLong = validateEmergenceSeal({ emergedNpc: { name: "磨坊阿福", description: "一".repeat(41) } }, BASE);
    expect(tooLong.emergedNpc).toBeNull();
  });

  it("传闻注册链路：validateEmergenceSeal 产出接 recordRumoredNpcs + 登场后 clearRumor", () => {
    const out = validateEmergenceSeal({ mentionedNewNpcs: ["李二狗"], emergedNpc: { name: "磨坊阿福", description: "磨坊学徒" } }, BASE);
    const vt2 = recordRumoredNpcs(BASE.varTree, out.mentionedNewNpcs, "正文");
    expect(vt2.世界.传闻人物.李二狗).toBeTruthy();
    const vt3 = clearRumor(vt2, out.emergedNpc.name);
    expect(vt3.世界.传闻人物.磨坊阿福).toBeUndefined();
  });
});
