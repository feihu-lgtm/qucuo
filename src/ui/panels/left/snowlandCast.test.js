import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getAdventurerById } from "../../../domain/rules/dungeon/dungeonPool.js";
import { getDistrictAnchor, getPublicInnerRoomNames } from "../../../domain/rules/map/innerMap.js";
import { residentNpcRule } from "../../../domain/rules/npc/rules.js";
import { npcArtUrl } from "../../art/art.js";
import { partitionPeople } from "./peopleRoster.js";

const importedRegistry = { getImportedForDistrict: () => [], getImportedResidentNames: () => [] };

const casts = [
  ["打箭炉", [["阿洛扎西", "折多索桥"], ["朱弦", "榷茶官栈"], ["马跃川", "跑马山武馆", "adv_mayuechuan"], ["格桑央绒", "大锅庄总号", "adv_gesangyangrong"]]],
  ["丹霞城", [["洛桑曲培", "班智达辩经坛"], ["云丹梅朵", "溪卡纳租庄仓"], ["赤桑多杰", "三十六石柱大院", "adv_chisangduojie"], ["白玛令仪", "红盐客栈", "adv_baimailingyi"]]],
  ["焚风渡", [["仁杰洛布", "渡口淘金集"], ["玉珍桑果", "冰泉蒸衣池"], ["达杰听风", "皮筏客栈", "adv_dajietingfeng"], ["索央踏浪", "白牦牛官牧场", "adv_suoyangtalang"]]],
  ["琼隆古墟", [["平措乌金", "青稞朵玛庄房"], ["央青阿若", "黑石山民集"], ["多杰砾", "天铁矿炉坊", "adv_duojieli"], ["曲珍石燕", "对转铁索桥", "adv_quzhenshiyan"]]],
  ["白塔", [["洛丹嘉木", "哑钟石亭"], ["沈照铃", "唐蕃会盟古碑"], ["丹增云措", "塔顶", "adv_danzengyuncuo"], ["卓嘎听雨", "塔身檐廊", "adv_zhuogatingyu"]]],
];

describe("雪域五地青年角色在游戏中可见", () => {
  it.each(casts)("%s 初到时的公共房间各有相应人物、身份和立绘", (district, cast) => {
    const state = { room: { name: district, npcs: [] }, time: 6, companionState: {} };
    const room = residentNpcRule.run(state, { importedRegistry }).changes.room(state.room);
    const publicRooms = getPublicInnerRoomNames(district);
    const genders = ["男", "女", "男", "女"];
    for (const [i, [name, innerRoomName, advId]] of cast.entries()) {
      expect(publicRooms).toContain(innerRoomName);
      const { present } = partitionPeople({ room, innerRoomName, companionState: {} });
      const matches = present.filter(npc => npc.name === name);
      expect(matches, `${district}·${innerRoomName} 的${name}`).toHaveLength(1);
      const [npc] = matches;
      expect(npc.gender).toBe(genders[i]);
      expect(Boolean(npc.adventurer)).toBe(Boolean(advId));
      if (advId) expect(getAdventurerById(advId)?.name).toBe(name);
      const url = npcArtUrl(npc);
      expect(url).toBe(`/art/npc/${encodeURIComponent(name)}.webp`);
      expect(existsSync(`public${decodeURIComponent(url)}`)).toBe(true);
      const otherRoom = innerRoomName === getDistrictAnchor(district) ? publicRooms.find(n => n !== innerRoomName) : getDistrictAnchor(district);
      expect(partitionPeople({ room, innerRoomName: otherRoom, companionState: {} }).present.some(n => n.name === name)).toBe(false);
    }
  });
});
