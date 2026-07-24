import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import MudRPG from "./MudRPG.jsx";
import StartScreen from "./StartScreen.jsx";
import QuickBattleScreen from "./quickBattle/QuickBattleScreen.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { loadAutoSave, init as initSaves } from "./saves.js";

// 应用外壳：先展示开始界面，"开始"或"加载存档"之后才挂载真正的游戏主体 MudRPG。
// MudRPG 内部已有自己的设置面板逻辑，这里的"设置"入口复用同一套面板，
// 用 initialOpenSettings 告诉 MudRPG 挂载后直接弹出设置，而不是从头显示游戏画面。
//
// pendingLoadSlotId 的三种取值：
//   "new"        → 点击"开始"，强制新开局，忽略任何已有存档
//   "auto"       → 点击"加载存档"里的"自动存档"项
//   slot_xxxxxxx → 点击"加载存档"里某个具体的手动存档槽位
//
// 关键修复：之前每次刷新页面都会重新显示 StartScreen，玩家必须手动点
// "加载存档→自动存档"才能续上进度，点了排在最前面、最显眼的"开始"反而
// 会静默丢弃自动存档去新开局——这跟"存档失效了"的体验是一样的，必须改。
// 现在改为：应用启动时先检测一次自动存档是否存在，存在就直接跳过
// StartScreen，以 "auto" 模式挂载 MudRPG，刷新页面等于无缝续上进度；
// 完全没有自动存档（真正第一次玩）时，才展示 StartScreen 走原有流程。
function hasExistingAutoSave() {
  try {
    return !!loadAutoSave();
  } catch {
    return false;
  }
}

// 玩家在游戏内点了"返回主菜单"时会设置这个一次性标记再刷新页面；
// 读到后立刻清除，保证只在这一次刷新里生效，不会把后续所有刷新都焊死在开始菜单。
function consumeForceStartScreenFlag() {
  try {
    const flagged = sessionStorage.getItem("wuxia_mud_force_start_screen") === "1";
    if (flagged) sessionStorage.removeItem("wuxia_mud_force_start_screen");
    return flagged;
  } catch {
    return false;
  }
}

function App() {
  // 行为变更（本轮）：不再"有自动存档就跳过开始界面、直接续上缓存"。每次打开/刷新
  // 都先停在 StartScreen，由玩家自己选"开始（新开局）"还是"加载存档→自动存档/某个槽位"。
  // 这样避免一进来就闷头加载上次的浏览器缓存、看不到明确的读档入口。自动存档依然存在，
  // 只是变成"在开始界面里主动选它"而不是"自动灌进来"。forcedToStartScreen 逻辑保留（无害）。
  const [forcedToStartScreen] = useState(consumeForceStartScreenFlag);
  const [booted, setBooted] = useState(false);            // 恒为 false：总是先显示开始界面
  const [pendingLoadSlotId, setPendingLoadSlotId] = useState("new");
  const [openSettingsOnBoot, setOpenSettingsOnBoot] = useState(false);
  // 斗蛐蛐是脱离存档的独立沙盒：不经过 MudRPG，直接在开始界面之上挂一层。
  const [inQuickBattle, setInQuickBattle] = useState(false);

  if (inQuickBattle) {
    return <QuickBattleScreen onExit={() => setInQuickBattle(false)} />;
  }

  if (!booted) {
    return (
      <StartScreen
        onStart={() => {
          setPendingLoadSlotId("new");
          setOpenSettingsOnBoot(false);
          setBooted(true);
        }}
        onLoadSlot={(slotId) => {
          // StartScreen 传 null 代表"自动存档"，其余情况传具体槽位 id
          setPendingLoadSlotId(slotId || "auto");
          setOpenSettingsOnBoot(false);
          setBooted(true);
        }}
        onOpenSettings={() => {
          // 打开设置不需要新开局也不需要读档，用当前已有的自动存档兼容行为即可，
          // 传 null 让 tryRestoreSave 走"尝试自动存档"的默认分支
          setPendingLoadSlotId(null);
          setOpenSettingsOnBoot(true);
          setBooted(true);
        }}
        onQuickBattle={() => setInQuickBattle(true)}
        onExit={() => {
          // 浏览器环境无法真正"退出进程"，只能尝试关闭标签页；
          // 多数浏览器出于安全策略会拦截非用户直接触发的 window.close()，
          // 拦截时退化为提示，不强行伪造关闭效果。
          window.close();
          setTimeout(() => {
            if (!window.closed) {
              alert("浏览器已阻止自动关闭标签页，请手动关闭。");
            }
          }, 200);
        }}
      />
    );
  }

  return <MudRPG initialLoadSlotId={pendingLoadSlotId} initialOpenSettings={openSettingsOnBoot} />;
}

// 启动先把存档从 IndexedDB 全量灌进内存缓存（saves.init），之后所有存档读取都是同步的
// （hasExistingAutoSave / tryRestoreSave 都同步读缓存）。init 失败也照常渲染，saves 内部会走
// localStorage 降级。init 通常几十毫秒内完成，期间短暂空白可接受。
function mount() {
  // 全局错误边界（本轮）：把整个 App 包起来，任何界面（开始界面、设置、主游戏、
  // 各弹窗）在 render/生命周期里崩溃，都不再整屏黑屏，而是弹出错误框 + 具体报错 +
  // 「返回」按钮——仿照战斗界面 DuelScreen 那个错误边界的做法，推广到全局。
  // 顶层「返回」的语义：回到开始界面。做法是打一个一次性标记再刷新页面——因为顶层
  // 崩溃后若只是就地清 error 重渲染，崩因（比如坏存档）多半还在，会立刻再崩死循环；
  // 刷新回干净的开始界面最稳，玩家可从那里换存档/新开局。
  const backToStart = () => {
    try { sessionStorage.setItem("wuxia_mud_force_start_screen", "1"); } catch { /* ignore */ }
    window.location.reload();
  };
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <ErrorBoundary label="程序" onReset={backToStart}>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
initSaves().then(mount, mount);
