// ── WO-22A 容器坍缩（纯函数层）──────────────────────────────────
// 底稿 2.4：每个房间的容器在第一次被翻时才定下内容，定下即记为事实；
// collapsed:true 之后再翻只会得到「翻不出新东西」。
// 状态落点：varTree.世界.容器[据点/房名][容器名] = { collapsed, presetItems? }
// ——懒初始化：旧档没有该字段不炸，首次用到才补；引擎/domain 不直写 store，
// 坍缩写一律经判官事实 COLLAPSE_CONTAINER → materializeFacts → applyPatches。
//
// 容器清单由房间内容表声明（district 房间定义的可选 containers 数组）：
//   containers: [{ name, presetItems?: [{id?,name,desc?,quality?,category?}] }]
// 未声明的房间没有任何容器——前哨不渲染、翻找无从谈起，不编造。

// 房间声明的容器清单（规整化；非法条目丢弃）
export function declaredContainers(roomDef) {
  const list = Array.isArray(roomDef?.containers) ? roomDef.containers : [];
  return list
    .filter((c) => c && typeof c.name === "string" && c.name.trim())
    .map((c) => ({
      name: c.name.trim(),
      presetItems: (Array.isArray(c.presetItems) ? c.presetItems : [])
        .filter((it) => it && typeof it.name === "string" && it.name.trim())
        .map((it) => ({ ...it })),
    }));
}

// 读 varTree 里某房间某容器的坍缩状态；未记录/旧档无字段一律 false（未坍缩）
export function isContainerCollapsed(varTree, place, containerName) {
  return !!varTree?.世界?.容器?.[place]?.[containerName]?.collapsed;
}

// 组装判官 envelope 的容器视图：declared 声明 ∪ varTree 已记录状态。
// 输出 { [容器名]: { collapsed, presetItems } }——presetItems 只来自内容表
// 声明（剧本写死的东西），坍缩状态只来自 varTree（事实账本）。
export function containerViewForRoom(varTree, place, roomDef) {
  const view = {};
  const recorded = varTree?.世界?.容器?.[place] || {};
  for (const decl of declaredContainers(roomDef)) {
    view[decl.name] = {
      collapsed: !!recorded[decl.name]?.collapsed,
      presetItems: decl.presetItems,
    };
  }
  return view;
}

// 前哨「可翻找容器」名单：只列未坍缩的——已坍缩的翻了也白翻，
// 列出来只会诱导模型反复写翻箱。无声明/全坍缩返回空数组。
export function intakeContainerLines(varTree, place, roomDef) {
  const view = containerViewForRoom(varTree, place, roomDef);
  return Object.entries(view)
    .filter(([, v]) => !v.collapsed)
    .map(([name]) => name);
}

// 判官容器上下文一站解析（runTurn 真实判官与 shadowJudge 影子共用同一入口——
// 同源口径只能靠"只此一处计算"钉死，各算各的迟早漂移）。
// 入参：districtName（room.name 据点名）、innerRoomName、varTree、roomDefLookup。
// 输出 { containerPlace, containerView, openContainers }。
export function resolveContainerContext({ districtName, innerRoomName, varTree, roomDefLookup }) {
  const innerDef = innerRoomName != null && typeof roomDefLookup === "function"
    ? roomDefLookup(districtName, innerRoomName)
    : null;
  const containerPlace = innerRoomName != null
    ? `${districtName || ""}/${innerRoomName}`
    : (districtName || "");
  return {
    containerPlace,
    containerView: containerViewForRoom(varTree, containerPlace, innerDef),
    openContainers: intakeContainerLines(varTree, containerPlace, innerDef),
  };
}
