import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ZONE_THEMES } from "../../../utils/theme.js";
import { NNPC_STAGE } from "../../../domain/rules/narrator/narrator.js";
import ProfileModule from "./ProfileModule.jsx";
import EquipmentBonusModule from "./EquipmentBonusModule.jsx";
import AttributesModule from "./AttributesModule.jsx";
import TeamModule from "./TeamModule.jsx";
import SkillsModule from "./SkillsModule.jsx";
import CombatMovesModule from "./CombatMovesModule.jsx";
import EquipmentModule from "./EquipmentModule.jsx";
import InventoryModule from "./InventoryModule.jsx";
import NarratorModule from "./NarratorModule.jsx";
import FaceEditor from "../../components/faces/FaceEditor.jsx";
import { RIGHT_FACE_DEFAULTS, RIGHT_MODULES } from "./rightFaces.js";
import JianghuModule, { JIANGHU_ENTRIES } from "./JianghuModule.jsx";
import { OVERLAY } from "../../../store/uiStore.js";
import { validateFacePreferences } from "../../components/faces/facePreferences.js";

const base = {
  zoneTheme: ZONE_THEMES.village,
  char: { name: "测试少侠", hp: [100, 100], special: { 根骨: 5 }, pigeons: 5 },
  inv: [], skills: [], activeBuffs: [], exp: 0, pot: 0,
  trainCost: () => 4, companionState: {}, varTree: {}, narrator: { affection: 0 },
};
const render = (Component, props = {}) => renderToStaticMarkup(createElement(Component, { ...base, ...props }));

describe("extracted right-panel modules", () => {
  it("preserves profile, equipment total, attributes and training content", () => {
    expect(render(ProfileModule)).toContain("测试少侠");
    expect(render(ProfileModule)).toContain("信鸽");
    expect(render(EquipmentBonusModule)).toContain("装备总加成：攻0 防0");
    const attributes = render(AttributesModule, { activeBuffs: [{ attr: "根骨", val: 2, remaining: 3 }] });
    expect(attributes).toContain("七维");
    expect(attributes).toContain("药力·根骨+2（余3）");
    expect(attributes).toContain("+1（4潜能）");
  });

  it("keeps companion and combat-move visibility conditions", () => {
    expect(render(TeamModule)).toBe("");
    expect(render(CombatMovesModule)).toBe("");
    const team = render(TeamModule, {
      companionState: { snowLeopard: { unlocked: true, active: true, data: { name: "雪豹" } } },
    });
    expect(team).toContain("队伍");
    expect(team).toContain("雪豹");
    const moves = render(CombatMovesModule, { char: { moveset: [
      { name: "硬架", type: "防御" }, { name: "技能派生", sourceSkill: "starter" },
    ] } });
    expect(moves).toContain("硬架");
    expect(moves).not.toContain("技能派生");
  });

  it("keeps idle skills collapsed and fixed moves separate from cultivation", () => {
    const skills = [
      { name: "三脚猫拳法", stage: "入门", active: true, moveType: "攻击" },
      { name: "未上阵招式", stage: "入门", active: false },
    ];
    const html = render(SkillsModule, { skills });
    expect(html).toContain("三脚猫拳法");
    expect(html).toContain("未上阵 1");
    expect(html).not.toContain("未上阵招式");
    expect(html).toContain("↑修炼");
    const fixed = render(SkillsModule, { skills: [{ name: "完整招式", fixed: true, active: true, move: { desc: "授得的招式" } }] });
    expect(fixed).toContain("授得的招式");
    expect(fixed).not.toContain("↑修炼");
  });

  it("preserves inventory empty states and equipment categories", () => {
    expect(render(InventoryModule)).toContain("空空如也");
    const equipment = render(EquipmentModule);
    for (const label of ["装备", "武器", "护甲", "饰品"]) expect(equipment).toContain(label);
    expect(render(InventoryModule, { inv: ["半袋青稞"] })).toContain("半袋青稞");
  });

  it("preserves narrator affection, confession and disconnected states", () => {
    expect(render(NarratorModule)).toContain("0/100");
    expect(render(NarratorModule, { narrator: { affection: 100 } })).toContain("可向旁白告白");
    expect(render(NarratorModule, { narrator: { confessed: true, memoryFragments: 3 } })).toContain("记忆碎片 3/8");
    expect(render(NarratorModule, { narrator: { stage: NNPC_STAGE.CRASHED } })).toContain("信号已断开");
  });

  it("offers all ten modules in the current-face editor, including unchecked conditional modules", () => {
    const html = renderToStaticMarkup(createElement(FaceEditor, {
      faces: { preferences: RIGHT_FACE_DEFAULTS, face: RIGHT_FACE_DEFAULTS.faces[0],
        availableModules: RIGHT_MODULES, minFaces: 1, maxFaces: 6 }, theme: ZONE_THEMES.village,
    }));
    expect(html.match(/type="checkbox"/g)).toHaveLength(10);
    expect(html).toContain("恢复默认");
    expect(html).toContain("上移侠客资料");
    expect(html).toContain("队伍");
    expect(html).toContain("江湖");
  });

  it("adds Jianghu for new layouts without changing legacy saved layouts", () => {
    expect(RIGHT_FACE_DEFAULTS.faces).toHaveLength(5);
    expect(RIGHT_FACE_DEFAULTS.faces.at(-1).modules).toEqual(["jianghu"]);
    const legacy = { faces: RIGHT_FACE_DEFAULTS.faces.slice(0, 4), currentIndex: 2 };
    expect(validateFacePreferences(legacy, RIGHT_FACE_DEFAULTS, { availableModules: RIGHT_MODULES })).toEqual(legacy);
  });

  it("renders the same four overlay entries previously in TopBar", () => {
    expect(JIANGHU_ENTRIES.map(entry => entry.overlay)).toEqual([
      OVERLAY.QUEST_LOG, OVERLAY.CHARACTER_PAGE, OVERLAY.LORE, OVERLAY.QIJUZHU,
    ]);
    const html = render(JianghuModule);
    expect(html.match(/<button/g)).toHaveLength(4);
    for (const entry of JIANGHU_ENTRIES) expect(html).toContain(entry.label);
  });
});

describe("RightPanel header", () => {
  it("keeps a 任务 button in the right column header, visible on every face", () => {
    const src = readFileSync(new URL("../RightPanel.jsx", import.meta.url), "utf8");
    expect(src).toMatch(/onClick=\{\(\) => openOverlay\(OVERLAY\.QUEST_LOG\)\}>任务<\/button>/);
  });
});
