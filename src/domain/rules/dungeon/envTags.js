// 十宫环境机制（设计_地宫内层地图.md §B「专属机制」的引擎化）
// 每个 handler 统一签名，全部由地宫 run 层按房间 envTag 驱动：
//   onEnter(room, runState)  —— 进入带该 envTag 的房间时
//   onAction(action, runState) —— 玩家在该宫内执行指令/战斗事件时
//   tick(runState)           —— 每回合/每步时钟
// 返回值统一 { log, effects }：log 为给叙事层的旁白（null=无事发生），
// effects 是结构化效果（statMod/check/damagePct/defeat/encounterRateBonus/
// trapDcBonus/teleport），由 run 层裁决落账，本文件纯函数无 IO、不改外部对象。
// 状态位都挂在 runState.envTags[tag] 上，由本文件自建自读。

const env = (rs, tag) => (rs.envTags ||= {})[tag] ||= {};

const ok = (log = null, effects = {}) => ({ log, effects });

export const ENV_TAG_HANDLERS = {
  // 白塔图书回廊·转经筒警报：战斗/检定失败敲响铜铃，下一房遇敌率抬高
  baitaPrayerWheel: {
    onEnter: (room, rs) => {
      const s = env(rs, "baita");
      if (!s.alarm) return ok();
      s.alarm = 0;
      return ok("暗线铜铃余音未绝，暗处护经武僧的脚步声近了。", { encounterRateBonus: 0.3 });
    },
    onAction: (action, rs) => {
      const s = env(rs, "baita");
      if (action.result !== "fail" && action.type !== "battleLost") return ok();
      s.alarm = (s.alarm || 0) + 1;
      return ok("你碰响了悬在暗线的铜铃，细微的铃音顺着廊柱传向深处。");
    },
    tick: () => ok(),
  },

  // 大草甸子虚幻境·孢子浓度：每深入一房叠一层，感知随之下降；检查点清零
  huanjingSpore: {
    onEnter: (room, rs) => {
      const s = env(rs, "spore");
      if (room.isCheckpoint) { s.level = 0; return ok("冷风吹散了鼻腔里的甜腥，视野清明了些。"); }
      if (room.isAnchor) return ok();
      s.level = Math.min(5, (s.level || 0) + 1);
      return ok("空气中的孢子又浓了一分，眼前的草浪开始轻轻扭曲。", { statMod: { 感知: -s.level * 3 } });
    },
    onAction: () => ok(),
    tick: (rs) => {
      const s = env(rs, "spore");
      return s.level ? ok(null, { statMod: { 感知: -s.level * 3 } }) : ok();
    },
  },

  // 三星堆大墓·滑翔翼巡逻：每走三步触发一次潜行检定，失败吃火器打击
  sanxingduiPatrol: {
    onEnter: () => ok(),
    onAction: () => ok(),
    tick: (rs) => {
      const s = env(rs, "patrol");
      s.steps = (s.steps || 0) + 1;
      if (s.steps % 3 !== 0) return ok();
      return ok("头顶通风井传来羽翼破风之声——滑翔翼掠过悬廊！", {
        check: { stat: "隐蔽", dc: 50, onFail: { damagePct: 0.15, note: "甩手铳弹丸擦着石壁炸开" } },
      });
    },
  },

  // 蜀王府地宫·磷火死士：每次受击，尸油磷粉扑面，命中续降
  shuwangPhosphor: {
    onEnter: () => ok(),
    onAction: (action, rs) => {
      const s = env(rs, "phosphor");
      if (action.type !== "hitTaken") return ok();
      s.stacks = Math.min(4, (s.stacks || 0) + 1);
      return ok("死士身上的磷粉被震得四散，呛得你睁不开眼。", { statMod: { 命中: -s.stacks * 5 } });
    },
    tick: (rs) => {
      const s = env(rs, "phosphor");
      return s.stacks ? ok(null, { statMod: { 命中: -s.stacks * 5 } }) : ok();
    },
  },

  // 雪山茫野·失温：露天房（room.openAir）行动累积全属性降，避风房（room.shelter）生火清零
  xueshanWindchill: {
    onEnter: (room, rs) => {
      const s = env(rs, "chill");
      if (room.shelter) { s.level = 0; return ok("你拢起一堆枯枝生火，冻僵的手指渐渐回温。"); }
      if (room.openAir) {
        s.level = Math.min(6, (s.level || 0) + 1);
        return ok("风像刀子一样割过裸露的皮肤，四肢开始发麻。", { statMod: { 全属性: -s.level * 2 } });
      }
      return ok();
    },
    onAction: (action, rs) => {
      const s = env(rs, "chill");
      if (action.type !== "lightFire" || !s.level) return ok();
      s.level = Math.max(0, s.level - 3);
      return ok("火舌窜起，暖意顺着血脉爬回指尖。", { statMod: { 全属性: -s.level * 2 } });
    },
    tick: (rs) => {
      const s = env(rs, "chill");
      return s.level ? ok(null, { statMod: { 全属性: -s.level * 2 } }) : ok();
    },
  },

  // 雾隐五仙秘洞·毒素渗透：战斗中每回合体质检定，失败持续扣血
  wuxianVenom: {
    onEnter: (room, rs) => {
      if (room.inCombatZone || room.isBoss) env(rs, "venom").active = true;
      return ok();
    },
    onAction: () => ok(),
    tick: (rs) => {
      const s = env(rs, "venom");
      if (!s.active) return ok();
      s.turns = (s.turns || 0) + 1;
      return ok("五彩瘴气顺着伤口往血脉里渗，指尖泛起青紫。", {
        check: { stat: "体质", dc: 40, onFail: { damagePct: 0.05, note: "毒瘴渗入经脉" } },
      });
    },
  },

  // 雅江悬棺裂谷·立体索降：走 u/d 出口需身法或力量检定，失败跌半血落到底层
  yajiangRope: {
    onEnter: () => ok(),
    onAction: (action, rs) => {
      if (action.type !== "move" || !["u", "d"].includes(action.dir)) return ok();
      const s = env(rs, "rope");
      s.pending = true;
      return ok(null, {
        check: {
          stat: ["身法", "力量"], dc: 45,
          onFail: { damagePct: 0.5, teleport: "bottom", note: "藤蔓脱手，你顺着崖壁滚落谷底" },
        },
      });
    },
    tick: () => ok(),
  },

  // 天龙营摩呼罗迦蛇窟·试炼戒律：每宫按 seed 封一类指令，违者机括反震扣当前 50% 血
  tianlongSeal: {
    onEnter: (room, rs) => {
      const s = env(rs, "seal");
      if (s.cmd) return ok();
      const pool = ["攻击", "偷窃", "施药", "切磋", "探查", "潜行"];
      let h = 0;
      for (const ch of `${rs.seed || ""}|${room.envTag}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      s.cmd = pool[h % pool.length];
      return ok(`石壁戒律铁牌翻出——此窟禁行「${s.cmd}」。`);
    },
    onAction: (action, rs) => {
      const s = env(rs, "seal");
      if (!s.cmd || action.cmd !== s.cmd) return ok();
      return ok("违背窟中铁律，暗壁机括反震伤身！", { damagePct: 0.5 });
    },
    tick: () => ok(),
  },

  // 鱼定土司内府禁库·更锣警戒：失败或战败惊动巡更铜锣，下一房遇敌率抬高；检查点清零
  tusiWatch: {
    onEnter: (room, rs) => {
      const s = env(rs, "tusiWatch");
      if (room.isCheckpoint) {
        s.alert = 0;
        return ok("暗廊铜锣暂歇，此间角落一时无人巡过。");
      }
      if (!s.alert) return ok();
      s.alert = Math.max(0, s.alert - 1);
      return ok("内院更锣余声未歇，巡捕营护院的脚步逼近了。", { encounterRateBonus: 0.3 });
    },
    onAction: (action, rs) => {
      const s = env(rs, "tusiWatch");
      if (action.result !== "fail" && action.type !== "battleLost") return ok();
      s.alert = Math.min(3, (s.alert || 0) + 1);
      return ok("惊动了廊下巡更铜锣，暗处火把晃动起来。");
    },
    tick: () => ok(),
  },

  // 蜀南唐堡千机楼·总齿轮：拆掉死路的总齿轮，同区块陷阱 DC 下降
  tangGear: {
    onEnter: () => ok(),
    onAction: (action, rs) => {
      const s = env(rs, "gear");
      if (action.type !== "sabotage" || action.target !== "gear" || s.broken) return ok();
      s.broken = true;
      return ok("总齿轮崩成一地铜屑，整层楼的机括声都哑了。", { trapDcBonus: -15 });
    },
    tick: (rs) => {
      const s = env(rs, "gear");
      return s.broken ? ok(null, { trapDcBonus: -15 }) : ok();
    },
  },

  // 欢喜教秘坛·欲火值：媚术命中或滞留累积，到顶即判负出局
  huanxiDesire: {
    onEnter: () => ok(),
    onAction: (action, rs) => {
      const s = env(rs, "desire");
      if (action.type === "seduced" || action.type === "charmHit") s.value = Math.min(100, (s.value || 0) + 25);
      else if (action.type === "meditate") s.value = Math.max(0, (s.value || 0) - 15);
      else return ok();
      if (s.value >= 100) return ok("欲火焚身，神智彻底堕入温柔乡——此行到此为止。", { defeat: true });
      return ok(null, { desire: s.value });
    },
    tick: (rs) => {
      const s = env(rs, "desire");
      s.value = Math.min(100, (s.value || 0) + 2); // 秘坛内滞留持续升温
      if (s.value >= 100) return ok("欲火焚身，神智彻底堕入温柔乡——此行到此为止。", { defeat: true });
      return s.value >= 60 ? ok("檀香混着体香往骨头缝里钻，你咬破舌尖才压住心猿。", { desire: s.value }) : ok(null, { desire: s.value });
    },
  },
};
