// 顶栏——横贯全宽的功能入口条 + 头像选择弹层。
// ---------------------------------------------------------------------------
// 从 MudRPG.jsx 抽出。两部分内容：
//   1. 顶栏本体：教程/图鉴、上报bug、
//      主菜单/存档/设置/日夜切换，以及右端的自动存档状态指示。
//      桌面端常显；手机端收成一个「☰ 菜单」，点开才换行铺开全部入口。
//   2. 头像选择弹层（showAvatarPicker）：8 张预制立绘 + 上传自定义 + 恢复默认。
//      跟顶栏放一起是因为它只由顶栏右侧的头像入口触发，别处不用。
//
// 顶栏按钮的统一规格 topBtn() 内聚在本文件（只依赖 zoneTheme.border，
// 别处不再需要）；遮罩点击关闭的 useOverlayCloseGuard 同样内聚。
import { chromeBtn } from "../../utils/theme.js";
import React, { useState, useEffect } from "react";
import { useOverlayCloseGuard } from "../../utils/overlayClose.js";
import { CURRENT_VERSION } from "../../utils/version.js";
import { getState as getMusicState, subscribe as subscribeMusic } from "../../infra/musicPlayer.js";
import { OVERLAY, closeOverlay, openOverlay, toggleOverlay, useOverlay } from "../../store/uiStore.js";
import { useGameStore } from "../../store/gameStore.js";
import { unreadLetterCount } from "../../features/pigeon/inbound.js";
import {
  useSessionUi, setGm, setIsDayMode, setMobileTopMenu, setSettingsInitialTab,
} from "../../store/sessionUiStore.js";
import TurnStatusPill from "../components/TurnStatusPill.jsx";

// 回合控制（停止/回滚）：桌面在中栏标题行，手机并入顶栏同一行
export function TurnControls({ theme, loading, stopRunning, rollbackBlocked, rollbackOneStep }) {
  return (
    <span className="mobile-center-toolbar-controls" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {loading && <span onClick={stopRunning} className="mobile-touch-target" style={chromeBtn(theme)}>⏹ 停止</span>}
      <span className="mobile-touch-target" onClick={rollbackBlocked ? undefined : rollbackOneStep}
        aria-disabled={rollbackBlocked}
        title="撤销上一步行动，还原到落子之前"
        style={{ ...chromeBtn(theme), ...(rollbackBlocked ? { color: theme.textDim, cursor: "not-allowed" } : {}) }}>
        {rollbackBlocked ? "等待落盘" : "↩ 回滚"}
      </span>
    </span>
  );
}

// 调试开关：桌面在中栏标题行，手机收进「☰ 菜单」
export function DevControls({ theme, addLog }) {
  const gm = useSessionUi(s => s.gm);
  const showDebug = useOverlay(OVERLAY.DEBUG);
  return (
    <>
      <span className="mobile-touch-target" onClick={() => toggleOverlay(OVERLAY.DEBUG)} style={chromeBtn(theme, { active: showDebug })}>调试</span>
      <span className="mobile-touch-target" onClick={() => { setGm(g => { const nv = !g; addLog([{ t: "sys", text: nv ? "  [/gamemode 1] 创造模式：无敌，战斗必胜，啥都能干" : "  [/gamemode 0] 生存模式：回归凡人之躯" }]); return nv; }); }} style={chromeBtn(theme, { active: gm })}>/gamemode {gm ? "0" : "1"}</span>
    </>
  );
}

export function VersionHistoryButton({ theme }) {
  const label = CURRENT_VERSION.version ? `${CURRENT_VERSION.version} · ${CURRENT_VERSION.time}` : CURRENT_VERSION.time;
  return <button type="button" onClick={() => openOverlay(OVERLAY.VERSION_HISTORY)} title={`当前版本「${CURRENT_VERSION.codename}」· 点击查看版本历史目录`} style={chromeBtn(theme, { active: false })}>{label}</button>;
}

export default function TopBar({
  zoneTheme,
  dispatchCommand,
  autoSaveError, lastAutoSave,
  playerAvatarCustom, setPlayerAvatarCustom,
  AV_BASE, genderAvatar,
  turnControls, addLog,
}) {
  const isMobile = useSessionUi(s => s.isMobile);
  const mobileTopMenu = useSessionUi(s => s.mobileTopMenu);
  const isDayMode = useSessionUi(s => s.isDayMode);
  const openSettings = (tab) => dispatchCommand
    ? dispatchCommand("settings", () => {
      setSettingsInitialTab(tab);
      openOverlay(OVERLAY.SETTINGS);
    })
    : (setSettingsInitialTab(tab), openOverlay(OVERLAY.SETTINGS));
  const showAvatarPicker = useOverlay(OVERLAY.AVATAR_PICKER);
  // 顶栏按钮统一规格：此前每个按钮各自 padding/字号/色系，一字排开像彩虹糖纸。
  // 收敛成"同一副骨架 + 三色语义"：金=重要入口，松石绿=设置/切换，绛红=上报，其余用正文/次要色。
  const topBtn = (active = false) => chromeBtn(zoneTheme, { active });
  const avatarPickerCloseGuard = useOverlayCloseGuard(() => closeOverlay(OVERLAY.AVATAR_PICKER));
  // 音乐按钮要同时跟 playing 和 enabled 走。原来只订阅了 playing，而
  // `{isMusicEnabled() && ...}` 是渲染期直接读 localStorage 的非响应式调用——
  // 在设置里勾上"音乐模式"，这个按钮不会冒出来，得等别的 state 变化捎带重渲染。
  const [musicState, setMusicState] = useState(getMusicState);
  useEffect(() => subscribeMusic(setMusicState), []);
  const musicPlaying = musicState.playing;
  const musicEnabled = musicState.enabled;
  const unreadLetters = useGameStore(unreadLetterCount);

  return (
    <>
      <div className="mobile-top-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderBottom: `1px solid ${zoneTheme.border}`, flexShrink: 0, fontSize: "var(--fs-xs)", backgroundImage: `linear-gradient(180deg, ${zoneTheme.bgPanel}, transparent)`, flexWrap: "wrap", rowGap: 8 }}>
        {/* 手机端：顶栏收成一个☰按钮，点开才展开全部功能入口 */}
        {isMobile && (
          <>
            <span className="mobile-touch-target mobile-menu-toggle" onClick={() => setMobileTopMenu(v => !v)}
              style={{ ...topBtn(mobileTopMenu), fontSize: "var(--fs-md)" }}>☰ 菜单</span>
            <span style={{ flex: 1 }} />
            {!mobileTopMenu && turnControls && <><TurnControls theme={zoneTheme} {...turnControls} /><TurnStatusPill theme={zoneTheme} mobile /></>}
            {mobileTopMenu && <span className="mobile-touch-target" onClick={() => setMobileTopMenu(false)} style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: "var(--fs-xs)" }}>收起 ✕</span>}
          </>
        )}
        {/* 顶栏功能入口：桌面常显；手机仅在展开菜单时显示（换行铺开） */}
        <div className="mobile-top-menu" style={{
          display: (!isMobile || mobileTopMenu) ? (isMobile ? "grid" : "flex") : "none",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          alignItems: "center", gap: 8, flexWrap: "wrap", rowGap: 8,
          width: isMobile ? "100%" : "auto", flex: isMobile ? "none" : 1,
        }}>
        {isMobile && <DevControls theme={zoneTheme} addLog={addLog} />}
        {isMobile && <span className="qbtn" onClick={() => openOverlay(OVERLAY.TRACE)} style={topBtn()}>日志</span>}
        <span
          className="qbtn"
          onClick={() => openOverlay(OVERLAY.TUTORIAL)}
          style={topBtn()}
        >新手教程</span>
        <span
          className="qbtn"
          onClick={() => openOverlay(OVERLAY.CODEX)}
          title="百物·武学总览：看全所有物品与武学的介绍、品阶、效果"
          style={topBtn()}
        >图鉴</span>
        <span className="qbtn" onClick={() => openOverlay(OVERLAY.BUG_REPORT)} title="遇到问题或有建议，点这里上报" style={topBtn()}>上报bug</span>
        {unreadLetters > 0 && (
          <span className="qbtn" onClick={() => openOverlay(OVERLAY.LETTERS)}
            title="有人给你捎了信——点开查看全部来信"
            style={{ ...topBtn(), color: zoneTheme.accent, fontWeight: 600 }}>信×{unreadLetters}</span>
        )}

        <span className="mobile-hide" style={{ flex: 1 }} />

        {/* 右组：其余全部右对齐 */}
        <span
          className="qbtn"
          onClick={() => openOverlay(OVERLAY.CARD_IMPORT)}
          title="角色入册：把外部角色卡导进曲措乡（快捷键 I）"
          style={topBtn()}
        >入册</span>
        <span
          className="qbtn"
          onClick={() => {
            if (window.confirm("返回开始菜单？当前进度已自动保存，可以随时继续。")) {
              sessionStorage.setItem("wuxia_mud_force_start_screen", "1");
              window.location.reload();
            }
          }}
          style={topBtn()}
        >主菜单</span>
        <span
          className="qbtn"
          onClick={() => openSettings("saves")}
          style={topBtn()}
        >存档</span>
        <span className="qbtn" onClick={() => openSettings(null)} style={topBtn()}>设置</span>
        <span
          className="qbtn"
          onClick={() => setIsDayMode(d => !d)}
          title={isDayMode ? "切回暗夜模式" : "切换到日间模式（米色底+棕框）"}
          style={topBtn()}
        >{isDayMode ? "日间" : "夜间"}</span>
        {musicEnabled && (
          <span
            className="qbtn"
            onClick={() => openOverlay(OVERLAY.MUSIC_PANEL)}
            title={musicState.error ? `音乐出错：${musicState.error}` : "音乐面板 — 曲库切换"}
            style={topBtn(musicPlaying)}
          >{musicPlaying ? "音乐·播放中" : "音乐"}</span>
        )}
        {/* 🏠 家园入口已挪到左栏「此地建筑」区——它本来就是"这间屋子里有什么设施"，
            跟顶栏那排全局按钮（设置/存档/图鉴/音乐）不是一回事，摆在顶栏既占地方
            又容易被当成全局功能。见 LeftPanel 的建筑区。 */}
        {autoSaveError && (
          <span
            title={`自动存档失败：${autoSaveError}。当前进度可能无法保存，建议尽快手动导出或清理浏览器存储空间。`}
            style={{ color: "var(--qb-versus)", fontSize: "var(--fs-2xs)", cursor: "help" }}
          >⚠ 存档失败</span>
        )}
        {!autoSaveError && lastAutoSave && (
          <span style={{ color: "var(--music-idle-icon)", fontSize: "var(--fs-2xs)", transition: "opacity 0.3s" }}>● 已保存</span>
        )}
        {/* 桌面版右上角同 iOS：全流程日志入口 + 回合状态灯 */}
        {!isMobile && (
          <>
            <span className="qbtn" onClick={() => openOverlay(OVERLAY.TRACE)} style={topBtn()}>日志</span>
            <TurnStatusPill theme={zoneTheme} docked />
          </>
        )}
        </div>
      </div>


      {showAvatarPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(4,4,10,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={avatarPickerCloseGuard.onMouseDown} onClick={avatarPickerCloseGuard.onClick}>
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: 0, padding: 24, width: 460, maxWidth: "90vw", color: "var(--text)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ color: "var(--accent)", fontSize: "var(--fs-lg)" }}>选择头像</span>
              <span className="mobile-overlay-close" style={{ color: "var(--text-dim)", fontSize: "var(--fs-sm)", cursor: "pointer" }} onClick={() => closeOverlay(OVERLAY.AVATAR_PICKER)}>× 关闭</span>
            </div>
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-dim)", marginBottom: 14 }}>
              选一张预制头像，或上传自己的图片（建议 2:3 竖版）。选择只影响你自己的显示，存在本地浏览器。
            </div>
            {/* 预制头像：从 public/portraits/player/ 读，共8张同一批唐卡风格厚涂立绘
                （male=藏剑大叔/female=花商/other=朔风刀客·默认兜底/preset1~5=飞贼·猎手·
                猫人·假小子·穿越者）。文件名约定 male/female/other + preset1..N，2:3竖版。 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              {[genderAvatar["男"], genderAvatar["女"], AV_BASE + "other.webp",
                AV_BASE + "preset1.webp", AV_BASE + "preset2.webp", AV_BASE + "preset3.webp",
                AV_BASE + "preset4.webp", AV_BASE + "preset5.webp"].map((src, i) => (
                <div key={i}
                  onClick={() => { setPlayerAvatarCustom(src); closeOverlay(OVERLAY.AVATAR_PICKER); }}
                  style={{ aspectRatio: "2/3", borderRadius: 0, overflow: "hidden", cursor: "pointer", border: playerAvatarCustom === src ? "2px solid var(--accent)" : "1px solid var(--border)", background: "var(--bg-panel)" }}
                >
                  <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ cursor: "pointer", fontSize: "var(--fs-sm)", color: "var(--accent)", padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 0 }}>
                ⬆ 上传图片
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = reader.result;
                      setPlayerAvatarCustom(dataUrl);
                      closeOverlay(OVERLAY.AVATAR_PICKER);
                    };
                    reader.readAsDataURL(file);
                  }} />
              </label>
              {playerAvatarCustom && (
                <span onClick={() => { setPlayerAvatarCustom(""); closeOverlay(OVERLAY.AVATAR_PICKER); }}
                  style={{ cursor: "pointer", fontSize: "var(--fs-sm)", color: "var(--ink-danger-soft)", padding: "6px 12px", border: "1px solid var(--footer-stalled-bg)", borderRadius: 0 }}>
                  恢复默认（按性别）
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
