// 界面调用 AI 的唯一入口（路线图 U4-1）。
// ---------------------------------------------------------------------------
// 界面（src/ui/）不直接 import engine/ports：要发 AI 请求、问是否配了密钥，都经这里。
// 这一层目前只是转出，先把依赖边界立住——分层方向 ui → app → engine，棘轮的
// portsImporters 计数随之下降。后续把调用点与加载状态收进 hooks 时，界面的
// import 不必再改。全流程日志 TraceViewer 是只读调试界面，按路线图保留对
// engine/ports/releaseMetrics 的只读访问，不经这里。

// 卡牌入册：扫描、分类、放置（CardImportScreen、cards/Placement）
export { planScan, runScan, runClassify, peopleAfterClassify } from "../../engine/ports/cardScan.js";
export { callCardModel } from "../../engine/ports/cardScan/scanCalls.js";

// 游说（PersuasionScreen）
export { createWebAi } from "../../engine/ports/ai.js";
export { runPersuadeTurn } from "../../engine/ports/persuasion.js";

// 地牢事件旁白（dungeon/DungeonScreen）
export { narrateDungeonEvent } from "../../engine/ports/dungeonNarration.js";

// 斗蛐蛐战报（quickBattle/BattleScreen）
export { narrateTurn } from "../../engine/ports/battleNarration.js";

// 酒馆经营夜报（tavernSim/TavernSimScreen）
export { createNarrator } from "../../engine/ports/simNarrator.js";

// 是否配了可用的密钥（BattleScreen、TavernSimScreen 决定要不要显示 AI 入口）
export { hasApiKey } from "../../engine/ports/storyteller.js";
