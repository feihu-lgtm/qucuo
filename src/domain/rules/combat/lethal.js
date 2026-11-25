// ── WO-23C2a 生死战 lethal 边界（纯函数，无 AI，无 UI 大流程）──────────────
// 边界铁律：切磋 spar/duel 默认非致命——抱拳认输即止，绝不致死/假死；
// 生死战只能由显式 lethal 入口/明确敌对生死指令进入（本单只建规则+API，
// 自然入口/追杀令接线留后续工单，不硬造 UI）。
// 生死判定位置（裁决写进 docs）：lethal win 的击杀/放过/假死候选是
// deterministic 系统事实，判定就在本模块 lethalVerdict——AI 不得决定生死，
// 正文只能按已签发事实写。

// 生死簿账本：varTree.世界.生死[name] = {status,turn,place,fakeDeadCandidate}
// status ∈ "dying"（垂死倒地，救治/补刀/假死分歧留后续工单）| "spared"（手下留情）

// 判定（纯函数）：
//   lethal !== true / outcome!=="win" / 无 npc → null（切磋链零影响）；
//   spare=true → spared（玩家明示放过，仍是系统事实不是 AI 心意）；
//   否则 dying。fakeDeadCandidate：宿敌谱已有 active entry（结过怨的才有
//   假死遁走的动机与江湖位置）——候选≠事实，真假死裁决留 WO-23C2b。
export function lethalVerdict({ outcome, lethal = false, spare = false, nemesisActive = false } = {}) {
  if (!lethal || outcome !== "win") return null;
  const status = spare ? "spared" : "dying";
  return { status, fakeDeadCandidate: status === "dying" && nemesisActive };
}

// 生死簿记账（纯函数不原地改；无账返回 null）。
// 幂等：同 turn 同 npc 重复结算不覆盖（补刀/救治时序留后续工单）。
export function recordLethalOutcome(book, npc, verdict, { turn = 0, place = "" } = {}) {
  if (!npc?.name || !verdict) return null;
  const prev = book?.[npc.name];
  if (prev && prev.turn === turn) return null;
  return {
    ...(book || {}),
    [npc.name]: {
      status: verdict.status, turn, place,
      fakeDeadCandidate: !!verdict.fakeDeadCandidate,
    },
  };
}
