// 拜入门派与叛出规则（纯函数，不碰 React 状态）
// ============================================================================
// 对齐《曲措乡·全势力设计草案（增补版）》§4.3 与各分节：
//   · 全作 16 家势力中，9 家为可正式拜入的武学门派，7 家为不可拜入势力（客卿/声誉线）。
//   · 单门派上限：同时仅可正式隶属 1 个主门派。
//   · 拜入条件：本势力声誉 ≥ 40（正道大派青城/峨眉/丐帮另校验全局威望 ≥ 0；三星派校验威望 ≥ -60；
//     青城派另校验剑坪试剑首胜；欢喜教另校验已完成「香2·比武招贤」；雪山派保留既有内堂考较路径）。
//   · 拜入奖励：立加本势力声誉 +20，发门派信物，写入 `<门派>弟子` 身份 flag。
//   · 叛出/逐出惩罚：声誉直接重置（主动叛出 -40，重罪逐出 -70；若原声誉更低则保持原值），
//     收回门派信物、撤掉门派身份并记 `叛出:<门派>`，已学招式保留但锁死高阶武学突破。
import { factionRepOf } from "../economy/factionRep.js";

export const DEFECT_REP_RESET = -40;
export const EXPEL_REP_RESET = -70;

export const NON_JOINABLE_FACTIONS = Object.freeze([
  "鱼定土司府",
  "鱼定村",
  "喇嘛庙",
  "玉泉寨",
  "黑风寨",
  "百花门",
  "锦官城",
]);

export const SECT_ENTRIES = Object.freeze({
  雪山派: Object.freeze({
    sect: "雪山派",
    master: "何雨谢",
    buildingId: "sectentry_xueshan",
    buildingName: "拜师堂",
    district: "雪山派",
    flag: "雪山派弟子",
    keyName: "雪山派令牌钥匙",
    keyQuality: "绿",
    keyCategory: "misc",
    keyDesc: "雪山派正式弟子的令牌，青铜铸就，正面一座雪峰，背面刻着一个小小的「贰」。兼作弟子别院的门锁钥匙。",
    minRep: 40,
    minPrestige: 0,
    minAffection: 30,
    minNeigong: 5,
    tuition: 100,
    repBonus: 20,
    skillSet: "雪山",
    intro: "何雨谢坐在堂上，手里捧着一盏早凉了的茶。掌门不在山上，这些年门里大小事都是她在撑。声誉够门墙之交，或得她认可、内功扎实并备足束脩，便可入门。",
    alreadyHint: "内堂之后的弟子别院已对你开放。令牌随身收好，那也是别院的钥匙。",
    joinAction: "向何雨谢奉茶行礼，正式拜入雪山派门下，接过那枚刻着「贰」字的弟子令牌",
    legacyJoinAction: "向何雨谢奉上束脩，正式拜入雪山派门下，接过那枚刻着「贰」字的弟子令牌",
    moveBrief: "雪山派门规与弟子身份",
  }),
  青城派: Object.freeze({
    sect: "青城派",
    master: "一清道长",
    buildingId: "sect_entry_yajiang",
    buildingName: "青城山山门",
    district: "雅江",
    flag: "青城派弟子",
    keyName: "青城玄门竹牌",
    keyQuality: "蓝",
    keyCategory: "misc",
    keyDesc: "青城派正式弟子的青竹腰牌，正面篆刻「青城玄门」，背面嵌着一截岷江老竹节。",
    minRep: 40,
    minPrestige: 0,
    requiredFlags: Object.freeze([
      Object.freeze({ flag: "qingcheng_spar_first", key: "trial", label: "剑坪试剑：堂堂正正胜过青玄或松鹤道长", passText: "已胜", failText: "未胜" }),
    ]),
    tuition: 0,
    repBonus: 20,
    skillSet: "青城",
    bonusItems: Object.freeze([
      Object.freeze({ name: "三清松风铁剑", category: "weapon", quality: "绿", desc: "青城派发给新入门弟子的制式铁剑，剑脊刻松纹，重心沉稳。" }),
      Object.freeze({ name: "青城道袍", category: "armor", quality: "绿", desc: "青城门人常穿的藏青布道袍，袖口利落，便于在山阶与江畔行剑。" }),
    ]),
    intro: "一清道长立在石砌牌坊下，拂尘垂在袖侧。青城不收富贵子弟捐纳，只认门墙善缘、剑坪试剑与清白威望。",
    alreadyHint: "你已入青城门下，凭青城玄门竹牌可于三清殿研习本门高阶剑法与紫阳神功。",
    joinAction: "在青城山山门前明志试心，经一清道长点头，正式拜入青城派，领了青城玄门竹牌、三清松风铁剑与青城道袍",
    moveBrief: "青城派门规与弟子身份",
  }),
  峨眉派: Object.freeze({
    sect: "峨眉派",
    master: "玄尘师太",
    buildingId: "sect_entry_emei",
    buildingName: "听竹轩·拜师堂",
    district: "锦官城",
    flag: "峨眉派弟子",
    keyName: "峨眉青玉弟子令",
    keyQuality: "蓝",
    keyCategory: "misc",
    keyDesc: "峨眉派正式弟子的青玉腰牌，正面刻一枝冷梅，背面镌「守静」二字。",
    minRep: 40,
    minPrestige: 0,
    tuition: 0,
    repBonus: 20,
    skillSet: "峨眉",
    intro: "玄尘师太端坐佛龛前，案上一炉檀香未断。峨眉佛道双修，门中虽以女弟子居多，亦不拒守静男弟子——唯须心正行端。",
    alreadyHint: "你已入峨眉门下，凭峨眉青玉弟子令可在峨眉剑庐请教兰花拂穴手、回风拂柳剑与峨眉十二庄。",
    joinAction: "在听竹轩向玄尘师太合十行礼，正式拜入峨眉派门下，领受峨眉青玉弟子令",
    maleCeremonyNote: "按峨眉门规先在抄经堂静心抄经三日，心静剑稳后再行授牌",
    moveBrief: "峨眉派佛道门规与弟子身份",
  }),
  唐门: Object.freeze({
    sect: "唐门",
    master: "唐老太",
    buildingId: "sect_entry_tangmen",
    buildingName: "宗祠·入堂石",
    district: "蜀南唐堡",
    flag: "唐门弟子",
    keyName: "玄竹弟子令",
    keyQuality: "蓝",
    keyCategory: "misc",
    keyDesc: "蜀南唐堡颁予正式门人的玄铁竹纹令，背面打着三瓣竹印，凭此出入内库与演武坪。",
    minRep: 40,
    minPrestige: null,
    tuition: 0,
    repBonus: 20,
    skillSet: "唐门",
    intro: "唐老太手里捻着一枚绣花针，笑眯眯地看着入堂石。唐门不问中原正邪虚名，只认手脚利落、信得过的自己人。",
    alreadyHint: "你已是唐门正式门人，凭玄竹弟子令可在千机演武坪修习满天星雨与百毒不侵体。",
    joinAction: "在蜀南唐堡宗祠入堂石前向唐老太行礼立誓，正式拜入唐门，接过玄竹弟子令",
    moveBrief: "唐门家法机括规矩与弟子身份",
  }),
  欢喜教: Object.freeze({
    sect: "欢喜教",
    master: "梵衍那",
    buildingId: "sect_entry_huanxi",
    buildingName: "坛城香案",
    district: "天都镇",
    flag: "欢喜教弟子",
    keyName: "莲纹铜牌",
    keyQuality: "蓝",
    keyCategory: "misc",
    keyDesc: "欢喜教内院真传弟子的暗金莲纹铜牌，触手微温，带着极淡的坛城异香。",
    minRep: 40,
    minPrestige: null,
    requiredQuests: Object.freeze([{ id: "huanxijiao_2_biwuzhaoxian", title: "香2·比武招贤" }]),
    tuition: 0,
    repBonus: 20,
    intro: "香案后三柱无烟红香静静燃着，梵衍那合目低眉。欢喜教不问侠名恶名，过了比武招贤、得内院信重，便可敬香入教。",
    alreadyHint: "你已是欢喜教内院弟子，莲纹铜牌随身收好。",
    joinAction: "在坛城香案前敬三柱无烟红香、饮下坛城茶，正式拜入欢喜教内院，领受莲纹铜牌",
    highPrestigeThreshold: 60,
    highPrestigeNote: "梵衍那打量着你一身侠名，似笑非笑地多问了一句「大侠既入坛城，可还放得下外头的规矩」",
    moveBrief: "欢喜教内院戒律与弟子身份",
  }),
  丐帮三星分舵: Object.freeze({
    sect: "丐帮三星分舵",
    master: "严九斤",
    buildingId: "sect_entry_gaibang",
    buildingName: "三星聚义堂",
    district: "广汉",
    flag: "丐帮三星分舵弟子",
    keyName: "三星青竹袋",
    keyQuality: "绿",
    keyCategory: "misc",
    keyDesc: "丐帮三星分舵记名一袋弟子的青竹麻布袋，系绳打着川西旧结。",
    minRep: 40,
    minPrestige: 0,
    tuition: 0,
    repBonus: 20,
    intro: "严九斤抱坛烈酒坐在竹阶上。丐帮讲义气、重名声，声誉够格且身家清白，喝了这碗酒便是一袋兄弟。",
    alreadyHint: "你已是丐帮三星分舵弟子，青竹袋挂在腰间，川西丐帮消息与义坊对你敞开。",
    joinAction: "向严九斤敬一碗烈酒，正式拜入丐帮三星分舵，背上三星青竹袋",
    moveBrief: "丐帮义律与一袋弟子身份",
  }),
  五仙教: Object.freeze({
    sect: "五仙教",
    master: "龙汐月",
    buildingId: "sect_entry_wuxian",
    buildingName: "五仙拜师坛",
    district: "雾隐寨",
    flag: "五仙教弟子",
    keyName: "银蛇弟子牌",
    keyQuality: "蓝",
    keyCategory: "accessory",
    keyDesc: "五仙教正式弟子的苗银缠蛇牌，佩之入雾隐瘴林可避寻常毒瘴。",
    minRep: 40,
    minPrestige: null,
    tuition: 0,
    repBonus: 20,
    intro: "拜师坛上摆着一碗苗家米酒，银铃轻响。五仙教不看中原正邪名声，受得住这一碗药酒，便是雾隐寨门人。",
    alreadyHint: "你已是五仙教正式弟子，银蛇弟子牌可助你穿行雾隐瘴林。",
    joinAction: "在五仙拜师坛饮下苗家米酒，向龙汐月行礼，正式拜入五仙教，领受银蛇弟子牌",
    moveBrief: "五仙教蛊毒门规与弟子身份",
  }),
  天龙教: Object.freeze({
    sect: "天龙教",
    master: "石重岳",
    buildingId: "sect_entry_tianlong",
    buildingName: "天龙点将台",
    district: "天龙营",
    flag: "天龙教弟子",
    keyName: "天龙弟子令",
    keyQuality: "蓝",
    keyCategory: "misc",
    keyDesc: "西域天龙教的玄铁重令，正面盘龙，背面刻着「止戈」与「血刃」交错暗纹。",
    minRep: 40,
    minPrestige: null,
    tuition: 0,
    repBonus: 20,
    skillSet: "血刀",
    intro: "石重岳按刀立于西风隘点将台。天龙教正邪不拒，只看手底下真功夫与教中声望。",
    alreadyHint: "你已是天龙教门人，凭天龙弟子令可修习血刀部与天龙高阶武学。",
    joinAction: "在天龙点将台接住三招试炼，向石重岳领令，正式拜入天龙教",
    highPrestigeThreshold: 40,
    highPrestigeNote: "石重岳冷笑一声，见你顶着川西侠名而来，额外加试了一招狠手才掷下令牌",
    moveBrief: "天龙教军律与弟子身份",
  }),
  三星派: Object.freeze({
    sect: "三星派",
    master: "纵目者",
    buildingId: "sect_entry_sanxing",
    buildingName: "授面坛",
    district: "广汉",
    flag: "三星派弟子",
    keyName: "青铜纵目令",
    keyQuality: "紫",
    keyCategory: "misc",
    keyDesc: "古蜀三星派颁予传人的青铜纵目残片令，绿锈斑驳，却与青铜神树同源共鸣。",
    minRep: 40,
    minPrestige: -60,
    tuition: 0,
    repBonus: 20,
    skillSet: "三星",
    intro: "青铜神树下金面人垂目静坐。三星派不拘寻常正邪，唯拒心魔蒙目的极恶之徒（威望不得低于 -60）。",
    alreadyHint: "你已是三星派传人，凭青铜纵目令可研习纵目剑法与纵目内视。",
    joinAction: "于青铜神树授面坛行开面问心礼，向纵目者受领青铜纵目令，正式拜入三星派",
    moveBrief: "三星派古蜀秘传与传人身份",
  }),
});

export const SECT_ENTRY = SECT_ENTRIES.雪山派;
export const SECT_MEMBER_FLAGS = Object.freeze(
  Object.fromEntries(Object.values(SECT_ENTRIES).map((entry) => [entry.sect, entry.flag])),
);

export function defectedFlag(sect) {
  return `叛出:${sect}`;
}

export function getSectEntry(sectOrBuilding) {
  if (!sectOrBuilding) return SECT_ENTRY;
  if (typeof sectOrBuilding === "object") {
    if (sectOrBuilding.sect && SECT_ENTRIES[sectOrBuilding.sect]) return SECT_ENTRIES[sectOrBuilding.sect];
    if (sectOrBuilding.id) {
      const byId = Object.values(SECT_ENTRIES).find((entry) => entry.buildingId === sectOrBuilding.id);
      if (byId) return byId;
    }
    return SECT_ENTRY;
  }
  const byId = Object.values(SECT_ENTRIES).find((entry) => entry.buildingId === sectOrBuilding);
  return SECT_ENTRIES[sectOrBuilding] || byId || null;
}

export function getPlayerSect(flags) {
  const list = flags || [];
  const found = Object.values(SECT_ENTRIES).find((entry) => list.includes(entry.flag));
  return found ? found.sect : null;
}

export function isPlayerInSect(flags, sect) {
  const entry = SECT_ENTRIES[sect];
  return !!entry && (flags || []).includes(entry.flag);
}

export function hasDefectedSect(flags, sect) {
  return !!sect && (flags || []).includes(defectedFlag(sect));
}

function normalizeCheckInput(input = {}, entry) {
  const varTree = input.varTree || {};
  const char = input.char || {};
  const flags = input.flags || [];
  const questProgress = input.questProgress || {};
  const affection = input.affection ?? varTree.角色?.[entry.master]?.好感度 ?? 0;
  const neigong = input.neigong ?? char.neigong ?? 0;
  const money = input.money ?? char.money ?? 0;
  const rep = input.rep ?? factionRepOf(varTree, entry.sect);
  const prestige = input.prestige ?? (Number(varTree.世界?.威望) || 0);
  return { affection, neigong, money, rep, prestige, flags, questProgress };
}

// 逐条检查入门资格，支持全部 9 家可拜入门派；雪山派保留既有内堂三门槛兼容路径。
export function checkSectEntry(input = {}, sectName = "雪山派") {
  const entry = getSectEntry(sectName) || SECT_ENTRY;
  const { affection, neigong, money, rep, prestige, flags, questProgress } = normalizeCheckInput(input, entry);
  const currentSect = getPlayerSect(flags) || input.otherSect || null;
  const already = isPlayerInSect(flags, entry.sect);
  const otherSect = currentSect && currentSect !== entry.sect ? currentSect : null;
  const defected = hasDefectedSect(flags, entry.sect);
  const reqs = [];

  if (otherSect) {
    reqs.push({
      key: "single",
      label: `未隶属他派（当前已拜入${otherSect}，须先退派）`,
      have: otherSect, need: "无门派", ok: false,
    });
  }
  if (defected) {
    reqs.push({
      key: "defected",
      label: `未曾叛出${entry.sect}（叛出后门墙永闭）`,
      have: "已叛出", need: "清白", ok: false,
    });
  }

  let usesLegacyPath = false;
  let tuitionDue = entry.tuition || 0;

  if (entry.sect === "雪山派") {
    const repOk = rep >= entry.minRep;
    const legacyOk = affection >= entry.minAffection && neigong >= entry.minNeigong && money >= entry.tuition;
    const prestigeOk = prestige >= entry.minPrestige;
    if (repOk) {
      tuitionDue = 0;
      reqs.push({
        key: "rep",
        label: `雪山派声誉（≥ ${entry.minRep}，门墙之交）`,
        have: rep, need: entry.minRep, ok: true,
      });
    } else {
      usesLegacyPath = legacyOk;
      reqs.push(
        {
          key: "affection",
          label: `${entry.master}的认可（好感度 ≥ ${entry.minAffection}，或雪山派声誉 ≥ ${entry.minRep}）`,
          have: affection, need: entry.minAffection, ok: affection >= entry.minAffection,
        },
        {
          key: "neigong",
          label: `内功底子（内功 ≥ ${entry.minNeigong}）`,
          have: neigong, need: entry.minNeigong, ok: neigong >= entry.minNeigong,
        },
        {
          key: "tuition",
          label: `束脩（银 ${entry.tuition} 两）`,
          have: money, need: entry.tuition, ok: money >= entry.tuition,
        },
      );
    }
    if (!prestigeOk) {
      reqs.push({
        key: "prestige",
        label: `江湖清白（威望 ≥ ${entry.minPrestige}）`,
        have: prestige, need: entry.minPrestige, ok: false,
      });
    }
  } else {
    reqs.push({
      key: "rep",
      label: `${entry.sect}声誉（≥ ${entry.minRep}，门墙之交）`,
      have: rep, need: entry.minRep, ok: rep >= entry.minRep,
    });
    if (entry.minPrestige != null) {
      reqs.push({
        key: "prestige",
        label: entry.minPrestige >= 0
          ? `江湖清白（威望 ≥ ${entry.minPrestige}）`
          : `心魔未炽（威望 ≥ ${entry.minPrestige}）`,
        have: prestige, need: entry.minPrestige, ok: prestige >= entry.minPrestige,
      });
    }
    for (const reqFlag of entry.requiredFlags || []) {
      const done = flags.includes(reqFlag.flag);
      reqs.push({
        key: reqFlag.key,
        label: reqFlag.label,
        have: done ? (reqFlag.passText || "已达成") : (reqFlag.failText || "未达成"),
        need: reqFlag.passText || "已达成",
        ok: done,
      });
    }
    for (const quest of entry.requiredQuests || []) {
      const done = questProgress?.[quest.id]?.status === "completed";
      reqs.push({
        key: `quest:${quest.id}`,
        label: `完成前置任务「${quest.title}」`,
        have: done ? "已完成" : "未完成", need: "已完成", ok: done,
      });
    }
  }

  return {
    sect: entry.sect,
    entry,
    rep,
    already,
    currentSect,
    defected,
    usesLegacyPath,
    tuitionDue,
    reqs,
    eligible: !already && !otherSect && !defected && reqs.every((r) => r.ok),
    missing: reqs.filter((r) => !r.ok).map((r) => r.key),
  };
}

export function computeDefectRep(currentRep, mode = "defect") {
  const target = mode === "expel" ? EXPEL_REP_RESET : DEFECT_REP_RESET;
  return Math.min(Number(currentRep) || 0, target);
}
