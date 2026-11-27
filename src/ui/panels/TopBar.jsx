// 顶栏——横贯全宽的功能入口条 + 头像选择弹层。
// ---------------------------------------------------------------------------
// 从 MudRPG.jsx 抽出。两部分内容：
//   1. 顶栏本体：教程/图鉴、上报bug、
//      主菜单/存档/设置/日夜切换，以及右端的自动存档状态指示。
//      桌面端常显；手机端收成一个「☰ 菜单」，点开才换行铺开全部入口。
//   2. 头像选择弹层（showAvatarPicker）：8 张预制立绘 + 上传自定义 + 恢复默认。
//      跟顶栏放一起是因为它只由顶栏右侧的头像入口触发，别处不用。
//
// 顶栏按钮的统一规格 topBtn() 内聚在本文件（只依赖 var(--border)，
// 别处不再需要）；头像选择弹窗套 ModalShell，遮罩点击关闭由外壳负责。
import { THEME_VARS } from "../../utils/theme.js";
import React, { useState, useEffect } from "react";
import ModalShell from "../primitives/ModalShell.jsx";
import { CURRENT_VERSION } from "../../utils/version.js";
import { getState as getMusicState, subscribe as subscribeMusic } from "../../infra/musicPlayer.js";
import { OVERLAY, closeOverlay, openOverlay, toggleOverlay, useOverlay } from "../../store/uiStore.js";
import { useGameStore } from "../../store/gameStore.js";
import { unreadLetterCount } from "../../features/pigeon/inbound.js";
import {
  useSessionUi, setGm, setIsDayMode, setMobileTopMenu, setSettingsInitialTab,
} from "../../store/sessionUiStore.js";
import TurnStatusPill from "../components/TurnStatusPill.jsx";
import { Button, Icon } from "../primitives/index.js";
import { getGameDay, getTimeStr } from "../../utils/mudHelpers.js";

function ShichenRing({ time }) {
  const frac = (((Number(time) || 0) % 24) + 24) % 24 / 24;
  const angle = frac * Math.PI * 2;
  const x = 13 + 10 * Math.sin(angle);
  const y = 13 - 10 * Math.cos(angle);
  const large = frac > 0.5 ? 1 : 0;
  return (
    <svg width="18" height="18" viewBox="0 0 26 26" className="topbar-ring" aria-hidden="true">
      <circle cx="13" cy="13" r="10" fill="none" stroke="var(--border)" />
      {frac > 0 && (
        <path
          d={`M13 3 A10 10 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)}`}
          fill="none"
          stroke="var(--warn)"
          strokeWidth="2"
        />
      )}
      <circle cx={x.toFixed(2)} cy={y.toFixed(2)} r="2.2" fill="var(--warn)" />
    </svg>
  );
}

// 回合控制（停止/回滚）：桌面在中栏标题行，手机并入顶栏同一行；一律图标，文字进悬停提示
export function TurnControls({ theme, loading, stopRunning, rollbackBlocked, rollbackOneStep, onMeditate }) {
  return (
    <span className="mobile-center-toolbar-controls topbar-turn-controls">
      {onMeditate && (
        // 生成中不收打坐：排进队列的回调会带着旧的 loading 回放、什么也不做，所以这时直接置灰。
        <Button
          variant="chrome"
          onClick={loading ? undefined : onMeditate}
          className={`mobile-touch-target topbar-icon-btn${loading ? " topbar-btn-disabled" : ""}`}
          aria-disabled={loading}
          aria-label="打坐"
          title={loading ? "本回合生成中，结束后才能打坐" : "打坐运功：消耗 1 回合，恢复部分气血（也可输入「打坐」）"}
        >
          <Icon name="打坐" size={15} />
        </Button>
      )}
      {loading && (
        <Button variant="chrome" onClick={stopRunning} className="mobile-touch-target topbar-icon-btn" aria-label="停止" title="停止本回合生成">
          <Icon name="停止" size={15} />
        </Button>
      )}
      <Button
        variant="chrome"
        className={`mobile-touch-target topbar-icon-btn${rollbackBlocked ? " topbar-btn-disabled" : ""}`}
        onClick={rollbackBlocked ? undefined : rollbackOneStep}
        aria-disabled={rollbackBlocked}
        aria-label={rollbackBlocked ? "等待落盘" : "回滚"}
        title={rollbackBlocked ? "等待落盘后才能回滚" : "撤销上一步行动，还原到落子之前"}
      >
        <Icon name="回滚" size={15} />
      </Button>
    </span>
  );
}

// 调试开关：桌面在中栏标题行（图标），手机收进「☰ 菜单」（菜单里铺开写字）
export function DevControls({ theme, addLog, inMenu = false }) {
  const gm = useSessionUi(s => s.gm);
  const showDebug = useOverlay(OVERLAY.DEBUG);
  return (
    <>
      <Button variant="chrome" active={showDebug} className="mobile-touch-target topbar-icon-btn" onClick={() => toggleOverlay(OVERLAY.DEBUG)} aria-label="调试" title="调试面板">
        {inMenu ? "调试" : <Icon name="调试" size={15} />}
      </Button>
      <Button variant="chrome" active={gm} className="mobile-touch-target topbar-icon-btn" aria-label={`/gamemode ${gm ? "0" : "1"}`} title={gm ? "创造模式开着：点一下回到生存模式（/gamemode 0）" : "切到创造模式：无敌，战斗必胜（/gamemode 1）"} onClick={() => { setGm(g => { const nv = !g; addLog([{ t: "sys", text: nv ? "  [/gamemode 1] 创造模式：无敌，战斗必胜，啥都能干" : "  [/gamemode 0] 生存模式：回归凡人之躯" }]); return nv; }); }}>
        {inMenu ? `/gamemode ${gm ? "0" : "1"}` : <Icon name="创造模式" size={15} />}
      </Button>
    </>
  );
}

export function VersionHistoryButton({ theme, compact = false }) {
  const fullLabel = CURRENT_VERSION.version ? `${CURRENT_VERSION.version} · ${CURRENT_VERSION.time}` : CURRENT_VERSION.time;
  const label = compact ? (CURRENT_VERSION.version || CURRENT_VERSION.time) : fullLabel;
  return <Button variant="chrome" active={false} type="button" className={compact ? "topbar-version-btn" : undefined} onClick={() => openOverlay(OVERLAY.VERSION_HISTORY)} title={`当前版本「${CURRENT_VERSION.codename}」(${CURRENT_VERSION.time}) · 点击查看版本历史目录`}>{label}</Button>;
}

export default function TopBar({
  zoneName,
  dispatchCommand,
  autoSaveError, lastAutoSave,
  playerAvatarCustom, setPlayerAvatarCustom,
  AV_BASE, genderAvatar,
  turnControls, addLog,
}) {
  const isMobile = useSessionUi(s => s.isMobile);
  const mobileTopMenu = useSessionUi(s => s.mobileTopMenu);
  const isDayMode = useSessionUi(s => s.isDayMode);
  const gameTime = useGameStore(s => s.time) ?? 0;
  const gameDay = getGameDay(gameTime);
  const shichen = getTimeStr(gameTime).replace(/^第\d+日·/, "").split("·")[0];
  const openSettings = (tab) => dispatchCommand
    ? dispatchCommand("settings", () => {
      setSettingsInitialTab(tab);
      openOverlay(OVERLAY.SETTINGS);
    })
    : (setSettingsInitialTab(tab), openOverlay(OVERLAY.SETTINGS));
  const showAvatarPicker = useOverlay(OVERLAY.AVATAR_PICKER);
  const [musicState, setMusicState] = useState(getMusicState);
  useEffect(() => subscribeMusic(setMusicState), []);
  const musicPlaying = musicState.playing;
  const musicEnabled = musicState.enabled;
  const unreadLetters = useGameStore(unreadLetterCount);
  const confirmMainMenu = () => {
    if (window.confirm("返回开始菜单？当前进度已自动保存，可以随时继续。")) {
      sessionStorage.setItem("wuxia_mud_force_start_screen", "1");
      window.location.reload();
    }
  };

  return (
    <>
      <div className="mobile-top-row topbar-root">
        {/* 手机端：顶栏收成一个☰按钮，点开才展开全部功能入口 */}
        {isMobile && (
          <>
            <Button variant="chrome" active={mobileTopMenu} className="mobile-touch-target mobile-menu-toggle" onClick={() => setMobileTopMenu(v => !v)}>☰ 菜单</Button>
            <span className="topbar-spacer" />
            {!mobileTopMenu && turnControls && <><TurnControls theme={THEME_VARS} {...turnControls} /><TurnStatusPill theme={THEME_VARS} mobile /></>}
            {mobileTopMenu && <span className="mobile-touch-target topbar-mobile-collapse" onClick={() => setMobileTopMenu(false)}>收起 ✕</span>}
          </>
        )}
        {!isMobile && (
          <div className="topbar-brand">
            <span className="topbar-title">天都·曲措</span>
            {zoneName && <span className="topbar-zone">天地 · {zoneName}</span>}
            <span className="topbar-clock">
              <ShichenRing time={gameTime} />
              <span>第{gameDay}日　<span className="topbar-shichen">{shichen}</span>　第{gameTime}回合</span>
            </span>
            <VersionHistoryButton theme={THEME_VARS} compact />
          </div>
        )}
        {/* 顶栏功能入口：桌面常显；手机仅在展开菜单时显示（换行铺开） */}
        <div
          className="mobile-top-menu topbar-actions"
          data-open={Boolean(!isMobile || mobileTopMenu)}
          data-mobile={Boolean(isMobile)}
        >
          {isMobile && <DevControls theme={THEME_VARS} addLog={addLog} inMenu />}
          {isMobile && <Button variant="chrome" className="qbtn" onClick={() => openOverlay(OVERLAY.TRACE)}>日志</Button>}
          {[
            ["入册", "角色入册：把外部角色卡导进曲措乡（快捷键 I）", () => openOverlay(OVERLAY.CARD_IMPORT)],
            ["图鉴", "百物·武学总览：看全所有物品与武学的介绍、品阶、效果", () => openOverlay(OVERLAY.CODEX)],
            ["日志", "全流程日志", () => openOverlay(OVERLAY.TRACE)],
            ["存档", "存档", () => openSettings("saves")],
            ["设置", "设置", () => openSettings(null)],
            ["主菜单", "返回主菜单", confirmMainMenu],
          ].filter(([icon]) => !(isMobile && icon === "日志")).map(([icon, title, onClick]) => (
            <Button key={icon} variant="chrome" className="qbtn topbar-icon-btn" onClick={onClick} aria-label={icon} title={title}>
              {isMobile ? icon : <Icon name={icon} size={17} />}
            </Button>
          ))}
          {!isMobile && <span className="topbar-sep" aria-hidden="true" />}
          <Button
            variant="chrome"
            className="qbtn topbar-icon-btn"
            onClick={() => setIsDayMode(d => !d)}
            aria-label={isDayMode ? "切回暗夜模式" : "切换到日间模式"}
            title={isDayMode ? "切回暗夜模式" : "切换到日间模式（米色底+棕框）"}
          >
            {isMobile ? (isDayMode ? "日间" : "夜间") : <Icon name="夜间" size={17} />}
          </Button>
          {musicEnabled && (
            <Button
              variant="chrome"
              active={musicPlaying}
              className="qbtn topbar-icon-btn"
              onClick={() => openOverlay(OVERLAY.MUSIC_PANEL)}
              aria-label="音乐面板"
              title={musicState.error ? `音乐出错：${musicState.error}` : "音乐面板 — 曲库切换"}
            >
              {isMobile ? (musicPlaying ? "音乐·播放中" : "音乐") : <Icon name="音乐" size={17} />}
            </Button>
          )}
          <Button
            variant="chrome"
            className="qbtn topbar-icon-btn"
            onClick={() => openOverlay(OVERLAY.TUTORIAL)}
            aria-label="新手教程"
            title="新手教程"
          >
            {isMobile ? "新手教程" : <Icon name="教程" size={17} />}
          </Button>
          <Button
            variant="chrome"
            className="qbtn topbar-icon-btn"
            onClick={() => openOverlay(OVERLAY.BUG_REPORT)}
            aria-label="上报问题"
            title="遇到问题或有建议，点这里上报"
          >
            {isMobile ? "上报bug" : <Icon name="上报" size={17} />}
          </Button>
          {!isMobile && <span className="topbar-sep" aria-hidden="true" />}
          {(unreadLetters > 0 || !isMobile) && (
            <Button
              variant="chrome"
              className={`qbtn topbar-icon-btn${unreadLetters > 0 ? " topbar-letter-unread" : ""}`}
              onClick={() => openOverlay(OVERLAY.LETTERS)}
              aria-label={unreadLetters > 0 ? `来信 ${unreadLetters} 封未读` : "来信"}
              title={unreadLetters > 0 ? `${unreadLetters} 封未读来信——点开查看` : "查看全部来信"}
            >
              {isMobile ? `信×${unreadLetters}` : (
                <span className="topbar-letter-wrap">
                  <Icon name="来信" size={17} />
                  {unreadLetters > 0 && <span className="topbar-unread-dot" aria-hidden="true" />}
                </span>
              )}
            </Button>
          )}
          {!isMobile && <span className="topbar-sep" aria-hidden="true" />}
          {autoSaveError && (
            <span
              className="topbar-save-err"
              role="status"
              aria-label="存档失败"
              title={`自动存档失败：${autoSaveError}。当前进度可能无法保存，建议尽快手动导出或清理浏览器存储空间。`}
            >
              {isMobile ? "存档失败" : <Icon name="存档失败" size={16} />}
            </span>
          )}
          {!autoSaveError && lastAutoSave && (
            <span className="topbar-save-ok" role="status" aria-label="已保存" title="已自动保存">
              {isMobile ? "已保存" : <Icon name="已保存" size={16} />}
            </span>
          )}
          {!isMobile && <TurnStatusPill theme={THEME_VARS} docked />}
        </div>
      </div>


      {showAvatarPicker && (
        // 头像选择沿用自己的标题栏（字号、间距与外壳默认不同），外壳只管遮罩、层级与关闭。
        // 原遮罩透明度 0.9，并入 --ink-overlay（0.92）；手机上原本不全屏，保持 mobile="none"。
        <ModalShell
          onClose={() => closeOverlay(OVERLAY.AVATAR_PICKER)}
          layer="screen-high"
          mobile="none"
          showClose={false}
          ariaLabel="选择头像"
          panelStyle={{ width: 460, padding: 24 }}
        >
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
                onClick={() => { setPlayerAvatarCustom(src); closeOverlay(OVERLAY.AVATAR_PICKER); }} className="avatar-pick-card" data-on={Boolean(playerAvatarCustom === src)}
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
                className="avatar-reset-btn">
                恢复默认（按性别）
              </span>
            )}
          </div>
        </ModalShell>
      )}
    </>
  );
}
