export default { district: {
白塔: {
    anchor: "塔基",
    rooms: {
      塔基: {
        x: 0, y: 0,
        desc: "半山孤立的古塔遗迹入口，塔身斑驳，藏传佛教的机关痕迹隐约可见。",
        exits: { n: "塔身檐廊", s: "白塔地宫" },
        residentNpcName: "罗布桑",
      },
      塔身檐廊: {
        x: 0, y: -1,
        desc: "沿塔而建的檐廊，任务8\"听雨悟剑\"的场景发生地。",
        exits: { s: "塔基", n: "塔顶" },
      },
      塔顶: {
        x: 0, y: -2,
        desc: "塔的最高处，眺望全乡视野点，风声呼啸。",
        exits: { s: "塔身檐廊" },
      },
      白塔地宫: {
        x: 0, y: 1,
        desc: "塔基地下的隐秘空间，守塔僧团驻守，任务16\"分赃规矩\"、守宫砂辅料收集地。",
        exits: { n: "塔基" },
        unlockCondition: { type: "flag", flag: "white_pagoda_crypt_clue" },
      },
    },
  }
} };
