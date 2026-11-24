import { OVERLAY, closeOverlay, openOverlay } from "../../store/uiStore.js";
import React, { useState } from "react";
import { hasApiCredentials, listConfigProfiles } from "../../infra/apiConfig.js";
import { listSlots } from "../../infra/saves.js";
import { countMemories } from "../../infra/memoryStore.js";
import { useOverlayCloseGuard } from "../../utils/overlayClose.js";
import InjectionStructurePanel from "./InjectionStructurePanel.jsx";
import ApiTab from "./settings/ApiTab.jsx";
import NarratorTab from "./settings/NarratorTab.jsx";
import SavesTab from "./settings/SavesTab.jsx";
import OtherTab from "./settings/OtherTab.jsx";

// 次级面板返回栏用的标题
const TAB_LABELS = { api: "API 配置", preset: "预设", narrator: "旁白", saves: "存档管理", other: "其他" };

// 设置面板壳：遮罩 + 头部 + 首页卡片宫格 + tab 分派。
// 各 tab 的实现在 ./settings/ 下；tab 内容的状态（测试/检测/展开/槽位等）由壳
// 集中持有——切 tab 时子组件卸载，状态放壳里回来才不丢。
export default function SettingsPanel({ cfg, setCfg, dispatchCommand, onClose, onOpenCardImport, currentSnapshot, onLoadSnapshot, varTree, setVarTree, initialTab, onSelectTab, uiScale, setUiScale, font, setFont, zoneTheme, narrator, setNarrator, getLiveBlockText }) {
  // 遮罩误触修复：原来外层遮罩单纯 onClick={onClose}，在弹窗内输入框/文本区域
  // 选字拖拽、鼠标移出弹窗范围松手时会被浏览器合成一次落在遮罩上的 click，
  // 导致"复制粘贴选着选着弹窗自己关了"。closeGuard 要求 mousedown 和 click
  // 都精确落在遮罩本身才真正关闭，见 utils/overlayClose.js。
  const closeGuard = useOverlayCloseGuard(onClose);
  const [tab, setTab] = useState(initialTab || null); // null=主页卡片 | api | preset | saves | other
  const selectTab = (next) => { setTab(next); onSelectTab?.(next); };
  const [testStatus, setTestStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
  const [testMsg, setTestMsg] = useState("");
  const [apiGroups, setApiGroups] = useState({ generation: false, length: false, profiles: false });
  const [slots, setSlots] = useState(listSlots());
  const [slotLabel, setSlotLabel] = useState("");
  const [modelList, setModelList] = useState(null); // null=未探测过, [] = 探测到但为空, [...] = 有结果
  const [modelStatus, setModelStatus] = useState(null); // null | 'loading' | 'error'
  // 提取模型也要能自动检测（本轮补齐）：复用同一份 modelList（提取调用渠道
  // 始终沿用主配置的 endpoint/key，跟主模型是同一个供应商同一份模型列表，
  // 不需要重新发请求检测）。这个状态记录"点击列表里的某一项，应该填到哪个
  // 字段"：null=主模型输入框，"extractionModel"=默认提取模型，其他字符串=
  // 某个意图key(如"MOVE")。modelPickerTarget非null时，模型列表渲染在对应
  // 位置且点击后写入对应字段并清空该状态收起列表。
  const [modelPickerTarget, setModelPickerTarget] = useState(null);
  const [modelErr, setModelErr] = useState("");
  const [memCount, setMemCount] = useState(null); // 记忆库条数（懒加载）

  React.useEffect(() => {
    if (tab === "api") countMemories().then(setMemCount).catch(() => setMemCount(null));
  }, [tab]);

  const patch = (fields) => setCfg(c => ({ ...c, ...fields }));

  // ── 配置 profile（多套 API 配置）与落盘导出/导入 ──
  const [cfgProfiles, setCfgProfiles] = useState(listConfigProfiles());
  const [cfgProfileName, setCfgProfileName] = useState("");

  // 分给 api tab 的状态袋（各 setter 原地透传，tab 内事件照旧可写）。
  const st = {
    testStatus, setTestStatus, testMsg, setTestMsg,
    apiGroups, setApiGroups,
    modelList, setModelList, modelStatus, setModelStatus,
    modelPickerTarget, setModelPickerTarget, modelErr, setModelErr,
    memCount, setMemCount,
    cfgProfiles, setCfgProfiles, cfgProfileName, setCfgProfileName,
  };

  return (
    <div className="mobile-overlay-root settings-root" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "var(--ink-overlay)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div className="mobile-overlay-panel mobile-settings-panel settings-panel" style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0, padding: 20, width: 520, maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto", fontFamily: "inherit", fontSize: "12.5px", color: "var(--text)" }} onClick={e => e.stopPropagation()}>

        <div className="mobile-overlay-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: "var(--accent)", fontSize: "14px" }}>
            {tab === null ? "⚙ 游戏设置" : (
              <span style={{ cursor: "pointer" }} onClick={() => selectTab(null)}>← 返回 · <span style={{ color: "var(--text)" }}>{TAB_LABELS[tab] || ""}</span></span>
            )}
          </span>
          <span className="mobile-overlay-close" style={{ color: "var(--text-dim)", fontSize: "11px", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
        </div>
        {tab === null && (
          <div className="settings-home-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
            {[
              ["api", "API 配置", "接口地址 · 密钥 · 模型"],
              ["preset", "📜 预设", "对话补全预设 · 编辑器"],
              ["narrator", "🎭 旁白", "好感度 · 阶段 · 私聊篇幅 · 专属世界书"],
              ["saves", "💾 存档管理", "读取 · 导出 · 删除"],
              ["other", "🎚 其他", "字号 · 显示"],
              ["__portraits", "立绘管理", "上传 · 更换人物立绘"],
              ["__cards", "🧾 角色入册", "游戏中 · 导入外部角色卡成江湖人物 · 快捷键 I"],
            ].filter(([id]) => id !== "__portraits" || hasApiCredentials(cfg)).map(([id, title, sub]) => (
              <div key={id} className="settings-home-card" onClick={() => {
                // 入册界面本身是全屏浮层，塞在设置里会套两层弹窗。
                // 这里改成关掉设置、把浮层交给 MudRPG 开。
                if (id === "__portraits") { closeOverlay(OVERLAY.SETTINGS); openOverlay(OVERLAY.PORTRAIT_MANAGER); return; }
                if (id === "__cards") { onOpenCardImport?.(); return; }
                selectTab(id);
              }}
                style={{
                  cursor: "pointer", padding: "20px 16px", borderRadius: 0,
                  background: "var(--bg-panel)", border: "1px solid var(--border)",
                  transition: "all 0.2s ease", textAlign: "center",
                }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-panel)"; e.currentTarget.style.borderColor = "var(--border)"; }}>
                <div style={{ fontSize: "15px", color: "var(--text)", marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: "10.5px", color: "var(--ink-sage)" }}>{sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* 预设 tab = 只有 Prompt 注入结构（本轮按作者要求精简）
            原来这里上下各有一块：上面是预设切换/导入酒馆JSON/导出，下面是可编辑的
            Prompt 条目列表。作者要的是"只看清楚喂了什么"，两头都拿掉了——
            PresetEditor 与 PresetManager 均已删除（零引用）。 */}
        {tab === "preset" && (
          <InjectionStructurePanel
            getLiveBlockText={getLiveBlockText}
            extractionEnabled={!!cfg.extractionEnabled}
            narratorLorebook={cfg.narratorLorebook || ""}
            onUpdateNarratorLorebook={setCfg ? (text) => patch({ narratorLorebook: text }) : undefined}
          />
        )}

        {tab === "api" && <ApiTab cfg={cfg} setCfg={setCfg} patch={patch} zoneTheme={zoneTheme} st={st} />}

        {tab === "narrator" && <NarratorTab cfg={cfg} patch={patch} narrator={narrator} setNarrator={setNarrator} />}

        {tab === "saves" && (
          <SavesTab cfg={cfg} patch={patch} dispatchCommand={dispatchCommand}
            currentSnapshot={currentSnapshot} onLoadSnapshot={onLoadSnapshot}
            slots={slots} setSlots={setSlots} slotLabel={slotLabel} setSlotLabel={setSlotLabel} />
        )}

        {tab === "other" && (
          <OtherTab uiScale={uiScale} setUiScale={setUiScale} font={font} setFont={setFont} zoneTheme={zoneTheme} />
        )}

      </div>
    </div>
  );
}
