// ── 房间写回：锁定目的地/固定地图/兜底三支（原 commitRound 内嵌块）──
// 路线甲纯函数化：writeRoom/roomHeader 返回结果描述，由 commitRound 经
// applyPostResult 统一落盘；ref 改显式入参 + refWrites。
import { QUCUO_MAP, getMapNode } from "../../../domain/data/map/qucuoMap.js";
import { patchCombatData } from "../../../domain/rules/npc/roomNpcs.js";
import { DIR_DXY } from "../../../utils/mudHelpers.js";
import { mergeGroundItems } from "../../../domain/rules/map/groundScope.js";

// 移动落地的地名标题「— 地名 —」。
// 它要排在本轮叙事正文之前，所以由 commitRound 在 emitNarrative 之前单独调用，不放在 writeRoom 里。
// 判定条件与 writeRoom 的两条移动分支一一对应：锁定目的地；或不在固定地图里、AI 报了新地名。
// 条目类型必须是 "room"：NarrativeLogFeed 靠它把标题单列，LogEntry 靠它居中并加破折号。
// （e8f6f57 拆模块时这里被误写成 "d.room"，标题因此退化成普通正文、落在叙事卡片末尾。）
export function roomHeaderName({ isTalk, lockedDestName, p, room }) {
  if (isTalk) return null;
  if (lockedDestName) return lockedDestName;
  if (p.room && !QUCUO_MAP[room.name] && p.room.name && p.room.name !== room.name) return p.room.name;
  return null;
}

// 返回 { insertLogs }：双调用模式下叙事在 runTurn 阶段就先于 commitRound 落日志了——
// 这里必须由 applyPostResult 插到本轮命令回显（cmd）之后、本轮其余条目之前，
// addLog 追加只会落在正文后面。
export function emitRoomHeader(ctx) {
  const name = roomHeaderName(ctx);
  if (!name) return null;
  return { insertLogs: [{ t: "room", text: "" }, { t: "room", text: `    ${name}` }, { t: "room", text: "" }] };
}

// traceStep 由调用方注入，保持本模块无 infra 依赖（externalInfraImports 只减不增）。
// 入参：roomMap=roomMapRef、outerDepart=outerDepartRef、pendDir=pendDirRef 的值、
// freshNpcData=fixateNpcs 的 dWrites。
export function writeRoom({ isTalk, lockedDestName, p, room, innerRoomName, roomMap, outerDepart, mapData, pendDir, freshNpcData }, { traceStep }) {
  if (isTalk) return null;
  const out = {};
  if (lockedDestName) {
    // 系统裁决：目的地、出口列表强制来自固定地图，不信任 AI 返回的 room.name/exits，
    // 只采用 AI 给出的 desc（场景描述文本）——这是本轮改造的核心："AI 只负责怎么形容，
    // 不负责去哪里"。
    const destNode = getMapNode(lockedDestName);
    const cached = roomMap[lockedDestName];
    // 首次到访无缓存时才会用 AI 报的名单；但 AI 常把刚离开那间屋里的人写成「跟着你来了」，
    // 驻场人物因此被带离本据点、从此在别处落户（npc.residents 又因他被缓存在别处而不再请回）。
    // 跟随只走同伴系统与追杀规则，这里把出发房间里的人一律剔掉。
    const leftBehind = new Set((room.npcs || []).map((npc) => npc.name));
    const arrivalNpcs = ((p.room && p.room.npcs) || []).filter((npc) => !leftBehind.has(npc?.name));
    const finalDesc = (p.room && p.room.desc) ? p.room.desc : destNode.desc;
    out.changes = {
      room: {
        name: lockedDestName,
        desc: finalDesc,
        exits: Object.keys(destNode.exits),
        npcs: (cached && cached.npcs) || arrivalNpcs,
        items: (cached && cached.items) || (p.room && p.room.items) || [],
      },
    };
    if (!mapData[lockedDestName]) {
      out.changes.mapData = (m) => ({ ...m, [lockedDestName]: { x: destNode.x, y: destNode.y } });
    }
    out.effects = [() => traceStep("状态写回", "pass", `room.name → ${lockedDestName}（移动完成）${outerDepart?.fromInner ? `，内层落点自动归为新据点锚点` : ""}`)];
  } else if (p.room && QUCUO_MAP[room.name]) {
    // 当前在固定地图范围内，且这次没有触发移动（比如原地互动/战斗），
    // 只允许 AI 更新 desc/items，name/exits/npcs 依然锁定为系统已有状态。
    // npcs 不能信任 AI 这次返回的名单——AI 每个回合都会重新交一份"它认为
    // 在场的人"的完整列表，如果直接铺盖过去，等于每次非移动动作都让AI
    // 重新发明一次在场人物，这正是"此地的人一会好几个一会都走光"的乱动
    // 根因。在场人物只应通过明确渠道变化：每日游走人口刷新（见下方
    // useEffect）、人物涌现（emergedNpcName，就发生在这行之前）、或玩家
    // 自己的动作——不该被这句话顺手覆盖。
    const node = QUCUO_MAP[room.name];
    // npcs 仍以系统既有名单 r.npcs 为准（不信 AI 这轮报的在场名单），但要把上面
    // 刚固化出来的战斗数据回填给名单里对应的人——名单不动、数据补齐。
    // 少了这一步，切磋掉落池恒为空（见 fixateNpcs 的注释）。
    out.changes = {
      // 地上物同理：AI 只看得到本房间的地上物，它报回的名单只能改写本房间那一份，
      // 别的内层房间的东西原样保留（见 groundScope.mergeGroundItems）。
      room: (r) => ({
        ...r, ...p.room, name: room.name, exits: Object.keys(node.exits),
        npcs: patchCombatData(r.npcs, freshNpcData),
        items: mergeGroundItems(r.items, p.room.items, room.name, innerRoomName),
      }),
    };
  } else if (p.room) {
    // 兜底：房间不在固定地图里（理论上不应该出现，只有 AI 未遵守系统裁决时才会
    // 落入这条路径）。这次修复已经从源头堵住了主要诱因——之前"向北走"这类带
    // 前缀词的移动指令会被 parseDir 误判为"非移动"，导致本该走上面 lockedDestName
    // 强锁分支的请求错误地流落到这里，AI 因此有机会自由发挥编出不在地图里的
    // 过渡地名（比如"熊曲山谷"）。parseDir 修好之后，只要玩家的移动意图能被正确
    // 识别，就不会再落入这条分支；这里维持原有的兜底自由生成逻辑，不额外强行拉回
    // 固定地图，避免打断正在进行的、AI已经开始编排的野生场景剧情。
    const moved = p.room.name && p.room.name !== room.name;
    if (moved) {
      const cached = roomMap[p.room.name];
      out.changes = {
        room: cached ? (r) => ({ ...r, ...p.room, items: cached.items, npcs: cached.npcs }) : (r) => ({ ...r, ...p.room }),
      };
      if (pendDir && !mapData[p.room.name]) {
        const [dx, dy] = DIR_DXY[pendDir] || [0, 0];
        const cur = mapData[room.name] || { x: 0, y: 0 };
        out.changes.mapData = (m) => ({ ...m, [p.room.name]: { x: cur.x + dx, y: cur.y + dy } });
      }
    } else {
      out.changes = { room: (r) => ({ ...r, ...p.room }) };
    }
  }
  return out;
}
