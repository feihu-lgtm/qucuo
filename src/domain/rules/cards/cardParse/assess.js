// 风险体检（从 cardParse.js 拆出，纯搬运）
// 给出「这张卡能不能导、要拒什么」的结论。不改数据，只出报告。

import { ENTRY_LEN_MAX } from "./normalize.js";

export function assessCard(card) {
  const es = card.entries;
  const n = es.length;
  const lens = es.map(e => e.length);
  const nonEmpty = lens.filter(x => x > 0);
  const medianLen = n ? lens.slice().sort((a, b) => a - b)[Math.floor(n / 2)] : 0;

  const blockers = [];
  const warnings = [];

  // R1 骨架卡：三个信号同时成立才判，避免误伤正常的小卡
  const allDisabled = n > 0 && es.every(e => !e.enabled);
  const mostlyEmpty = n > 0 && nonEmpty.length / n < 0.5;
  const helperHeavy = !!(card.scripts.tavernHelper && card.scripts.tavernHelper.size > 100000);
  if ((allDisabled && mostlyEmpty) || (mostlyEmpty && helperHeavy) || (card.nameIsMacro && mostlyEmpty)) {
    blockers.push({
      code: "SKELETON_CARD",
      msg: "这是一张模具卡（世界书条目大多为空、或整体关闭、或名字是宏），"
        + "内容要靠配套的预设和前端脚本在运行时生成。本引擎导入它只会得到一堆空条目。",
    });
  }

  // R3 脚本
  if (card.scripts.remoteImport) {
    warnings.push({
      code: "REMOTE_SCRIPT",
      msg: `卡里的前端脚本会从远程地址拉代码执行（${card.scripts.tavernHelper?.size} 字符）。`
        + "本引擎不执行任何卡内脚本，这部分会被完整忽略。",
    });
  } else if (card.scripts.tavernHelper || card.scripts.regexScripts) {
    warnings.push({
      code: "SCRIPT_IGNORED",
      msg: `卡里带 ${card.scripts.regexScripts} 条正则脚本`
        + `${card.scripts.tavernHelper ? " 和一套酒馆助手界面" : ""}，本引擎不支持，已忽略。`,
    });
  }
  if (card.scripts.otherExtensionKeys.length) {
    warnings.push({
      code: "UNKNOWN_EXTENSION",
      msg: `卡里有本引擎不认识的第三方扩展数据：${card.scripts.otherExtensionKeys.join("、")}，已忽略。`,
    });
  }

  // R2 超长
  const tooLong = es.filter(e => e.flags.includes("TOO_LONG"));
  if (tooLong.length) {
    warnings.push({
      code: "ENTRY_TOO_LONG",
      msg: `有 ${tooLong.length} 条超过 ${ENTRY_LEN_MAX} 字（最长 ${Math.max(...tooLong.map(e => e.length))} 字）。`
        + "一条命中就会顶穿单轮的 token 预算，默认不导入，需要的话请手动挑段落。",
      entries: tooLong.map(e => ({ label: e.label, length: e.length })),
    });
  }

  // R4 抗拒绝
  const jb = es.filter(e => e.flags.includes("JAILBREAK"));
  if (jb.length) {
    warnings.push({
      code: "JAILBREAK_ENTRY",
      msg: `有 ${jb.length} 条像是用来压制模型拒绝行为的指令。它们会跟本引擎自己的`
        + "身份声明和文体铁律抢方向盘，默认关闭。",
      entries: jb.map(e => ({ label: e.label, hint: e.jailbreakHint, length: e.length })),
    });
  }

  // R5 NSFW
  const nsfw = es.filter(e => e.flags.includes("NSFW"));
  if (nsfw.length) {
    warnings.push({
      code: "NSFW_ENTRY",
      msg: `有 ${nsfw.length} 条是成人向内容，原卡里它们无条件常驻。`
        + "导入后会改为挂在本引擎的开关下，关着就一个字不发。",
      entries: nsfw.map(e => ({ label: e.label, length: e.length })),
    });
  }

  // F14 脏 keys
  const dirty = es.filter(e => e.flags.includes("DIRTY_KEYS"));
  if (dirty.length) {
    warnings.push({
      code: "DIRTY_KEYS",
      msg: `有 ${dirty.length} 条的关键词把多个名字用逗号写在了一格里`
        + "（在酒馆里这样写其实永远匹配不上，作者多半没发现）。导入时已自动拆开。",
      entries: dirty.map(e => ({ label: e.label, raw: e.keysDirty })),
    });
  }

  // 死条目
  const dead = es.filter(e => e.flags.includes("DEAD"));
  if (dead.length) {
    warnings.push({
      code: "DEAD_ENTRY",
      msg: `有 ${dead.length} 条既没有关键词也不是常驻，在原卡里就永远不会被触发。`,
      entries: dead.map(e => ({ label: e.label, length: e.length })),
    });
  }

  // F10 位置冲突（只报数，解析已按 extensions 为准处理）
  const conflict = es.filter(e => e.positionConflict);
  if (conflict.length) {
    warnings.push({
      code: "POSITION_CONFLICT",
      msg: `有 ${conflict.length} 条的规范位置与酒馆内部位置不一致，已按内部位置为准。`,
    });
  }

  // 六字段是否可用作兜底
  const f = card.fields;
  const usableFields = Object.entries(f).filter(([, v]) => v && v.length > 20).map(([k]) => k);

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    stats: {
      entries: n,
      entriesEmpty: n - nonEmpty.length,
      totalLength: lens.reduce((a, b) => a + b, 0),
      maxLength: n ? Math.max(...lens) : 0,
      medianLength: medianLen,
      alwaysOn: es.filter(e => e.alwaysOn).length,
      openings: card.openings.length,
      usableFields,
    },
  };
}
