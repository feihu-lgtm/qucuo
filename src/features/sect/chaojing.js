// 峨眉男弟子入门礼：抄经堂静心抄经三日（三个不同的游戏日各抄一回）。
import { SECT_MEMBER_FLAGS } from "../../domain/rules/character/factionEntry.js";

export const CHAOJING = {
  buildingId: "library_emei_jingge",
  sect: "峨眉派",
  days: 3,
  hours: 4,
  dayFlag: "emei_chaojing_day_",
  countFlag: "emei_chaojing_",
  doneFlag: "emei_chaojing_done",
};

const dayOf = (time) => Math.floor((time || 0) / 24);
const isMale = (char) => (char?.gender || "男") === "男";

export function chaojingStatus({ char, flags = [], time } = {}) {
  const count = flags.filter((f) => /^emei_chaojing_\d+$/.test(f)).length;
  return {
    needed: isMale(char) && !flags.includes(SECT_MEMBER_FLAGS[CHAOJING.sect]),
    count,
    done: flags.includes(CHAOJING.doneFlag),
    today: flags.includes(`${CHAOJING.dayFlag}${dayOf(time)}`),
  };
}

export function doChaojing(state) {
  const status = chaojingStatus(state);
  if (!status.needed) return { logs: [{ t: "sys", text: "  抄经三日是峨眉给男弟子的入门礼，你用不着。" }] };
  if (status.done) return { logs: [{ t: "sys", text: "  三日经已抄足，去听竹轩拜师吧。" }] };
  if (status.today) return { logs: [{ t: "sys", text: "  今日已抄过经，明日再来。" }] };
  const n = status.count + 1;
  const finished = n >= CHAOJING.days;
  return {
    changes: {
      // 结算回合自身会再走 1 个时辰，这里只补余下的。
      time: (state.time || 0) + CHAOJING.hours - 1,
      flags: (flags = []) => [
        ...flags.filter((f) => !f.startsWith(CHAOJING.dayFlag)),
        `${CHAOJING.dayFlag}${dayOf(state.time)}`,
        `${CHAOJING.countFlag}${n}`,
        ...(finished ? [CHAOJING.doneFlag] : []),
      ],
    },
    logs: [{ t: "sys", text: `  （在抄经堂静心抄经两个时辰，第 ${n}/${CHAOJING.days} 日${finished ? "，入门礼已成" : ""}）` }],
    settle: finished
      ? "在抄经堂抄完了第三日的经，了因师太翻过经卷，点头说可以去听竹轩见玄尘师太了"
      : `在抄经堂临窗长案前静心抄了两个时辰的经，这是入门礼的第${n}日`,
  };
}
