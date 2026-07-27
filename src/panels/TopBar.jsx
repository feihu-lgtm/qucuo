// 顶栏——横贯全宽的功能入口条 + 头像选择弹层。
// ---------------------------------------------------------------------------
// 从 MudRPG.jsx 抽出。两部分内容：
//   1. 顶栏本体：教程/图鉴/版本、全流程日志/上报bug、人物关系/任务/见闻录、
//      主菜单/存档/设置/日夜切换，以及右端的自动存档状态指示。
//      桌面端常显；手机端收成一个「☰ 菜单」，点开才换行铺开全部入口。
//   2. 头像选择弹层（showAvatarPicker）：8 张预制立绘 + 上传自定义 + 恢复默认。
//      跟顶栏放一起是因为它只由顶栏右侧的头像入口触发，别处不用。
//
// 顶栏按钮的统一规格 topBtn() 内聚在本文件（只依赖 zoneTheme.border，
// 别处不再需要）；遮罩点击关闭的 useOverlayCloseGuard 同样内聚。
import { useOverlayCloseGuard } from "../utils/overlayClose.js";
import { CURRENT_VERSION } from "../version.js";

export default function TopBar({
  isMobile, mobileTopMenu, setMobileTopMenu,
  zoneTheme, isDayMode, setIsDayMode,
  uiGold, uiTurquoise, uiCrimson, uiPink,
  setShowTutorial, setShowCodex, setShowVersionHistory,
  showTrace, setShowTrace, setShowBugReport,
  setShowCharacterPage, setShowQuestLog, setShowLore,
  setSettingsInitialTab, setShowSettings,
  autoSaveError, lastAutoSave,
  showAvatarPicker, setShowAvatarPicker,
  playerAvatarCustom, setPlayerAvatarCustom,
  AV_BASE, genderAvatar,
}) {
  // 顶栏按钮统一规格：此前每个按钮各自 padding/字号/色系，一字排开像彩虹糖纸。
  // 收敛成"同一副骨架 + 三色语义"：金=重要入口，松石绿=设置/切换，绛红=上报，其余用正文/次要色。
  const topBtn = (color) => ({
    cursor: "pointer", color, padding: "2px 9px", fontSize: "10.5px",
    border: `1px solid ${zoneTheme.border}`, borderRadius: 3, background: "transparent",
  });
  const avatarPickerCloseGuard = useOverlayCloseGuard(() => setShowAvatarPicker(false));

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderBottom: `1px solid ${zoneTheme.border}`, flexShrink: 0, fontSize: "11px", backgroundImage: `linear-gradient(180deg, ${zoneTheme.bgPanel}, transparent)`, flexWrap: "wrap", rowGap: 6 }}>
        {/* 手机端：顶栏收成一个☰按钮，点开才展开全部功能入口 */}
        {isMobile && (
          <>
            <span onClick={() => setMobileTopMenu(v => !v)}
              style={{ cursor: "pointer", color: "#e8d0a0", padding: "3px 12px", background: "#1a140c", border: "1px solid #4a3a1a", borderRadius: 3, fontWeight: "bold", fontSize: "13px" }}>☰ 菜单</span>
            <span style={{ color: "#8a7a5a", fontSize: "10px" }}>{CURRENT_VERSION.time}</span>
            <span style={{ flex: 1 }} />
            {mobileTopMenu && <span onClick={() => setMobileTopMenu(false)} style={{ cursor: "pointer", color: zoneTheme.textDim, fontSize: "11px" }}>收起 ✕</span>}
          </>
        )}
        {/* 顶栏功能入口：桌面常显；手机仅在展开菜单时显示（换行铺开） */}
        <div style={{
          display: (!isMobile || mobileTopMenu) ? "flex" : "none",
          alignItems: "center", gap: 8, flexWrap: "wrap", rowGap: 6,
          width: isMobile ? "100%" : "auto", flex: isMobile ? "none" : 1,
        }}>
        <span
          className="qbtn"
          onClick={() => setShowTutorial(true)}
          style={{ ...topBtn(uiGold), fontWeight: "bold" }}
        >📖 新手教程</span>
        <span
          className="qbtn"
          onClick={() => setShowCodex(true)}
          title="百物·武学总览：看全所有物品与武学的介绍、品阶、效果"
          style={{ ...topBtn(uiGold), fontWeight: "bold" }}
        >📖 图鉴</span>
        <span
          className="qbtn"
          onClick={() => setShowVersionHistory(true)}
          title="点击查看版本历史目录"
          style={{ ...topBtn(zoneTheme.textDim), fontSize: "10px" }}
        >📅 {CURRENT_VERSION.time}</span>

        {/* 中组：日志 · 上报bug */}
        <span className="qbtn" onClick={() => setShowTrace(p => !p)} style={{ ...topBtn(showTrace ? uiTurquoise : zoneTheme.textDim), marginLeft: 12 }}>🧭 全流程日志</span>
        <span className="qbtn" onClick={() => setShowBugReport(true)} title="遇到问题或有建议，点这里上报" style={topBtn(uiCrimson)}>🐞 上报bug</span>

        <span style={{ flex: 1 }} />

        {/* 右组：其余全部右对齐 */}
        <span
          className="qbtn"
          onClick={() => setShowCharacterPage(true)}
          style={topBtn(uiPink)}
        >👥 人物关系</span>
        <span
          className="qbtn"
          onClick={() => setShowQuestLog(true)}
          style={topBtn(zoneTheme.text)}
        >📜 任务</span>
        <span
          className="qbtn"
          onClick={() => setShowLore(true)}
          style={topBtn(zoneTheme.text)}
        >📖 见闻录</span>
        <span
          className="qbtn"
          onClick={() => {
            if (window.confirm("返回开始菜单？当前进度已自动保存，可以随时继续。")) {
              sessionStorage.setItem("wuxia_mud_force_start_screen", "1");
              window.location.reload();
            }
          }}
          style={topBtn(zoneTheme.textDim)}
        >⏻ 主菜单</span>
        <span
          className="qbtn"
          onClick={() => { setSettingsInitialTab("saves"); setShowSettings(true); }}
          style={topBtn(uiGold)}
        >💾 存档</span>
        <span className="qbtn" onClick={() => { setSettingsInitialTab(null); setShowSettings(true); }} style={topBtn(uiTurquoise)}>⚙ 设置</span>
        <span
          className="qbtn"
          onClick={() => setIsDayMode(d => !d)}
          title={isDayMode ? "切回暗夜模式" : "切换到日间模式（米色底+棕框）"}
          style={topBtn(uiTurquoise)}
        >{isDayMode ? "☀ 日间" : "☾ 夜间"}</span>
        {autoSaveError && (
          <span
            title={`自动存档失败：${autoSaveError}。当前进度可能无法保存，建议尽快手动导出或清理浏览器存储空间。`}
            style={{ color: "#e0526a", fontSize: "9.5px", cursor: "help" }}
          >⚠ 存档失败</span>
        )}
        {!autoSaveError && lastAutoSave && (
          <span style={{ color: "#3a4a3a", fontSize: "9.5px", transition: "opacity 0.3s" }}>● 已保存</span>
        )}
        </div>
      </div>


      {showAvatarPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(4,4,10,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={avatarPickerCloseGuard.onMouseDown} onClick={avatarPickerCloseGuard.onClick}>
          <div style={{ background: "#0a0c14", border: "1px solid #2a3a3a", borderRadius: 8, padding: 24, width: 460, maxWidth: "90vw", color: "#c8bfa0" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ color: "#6ec6c6", fontSize: "15px" }}>选择头像</span>
              <span style={{ color: "#5a5a4a", fontSize: "12px", cursor: "pointer" }} onClick={() => setShowAvatarPicker(false)}>× 关闭</span>
            </div>
            <div style={{ fontSize: "11.5px", color: "#8a8a7a", marginBottom: 14 }}>
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
                  onClick={() => { setPlayerAvatarCustom(src); try { localStorage.setItem("qucuo_player_avatar", src); } catch { /* ignore */ } setShowAvatarPicker(false); }}
                  style={{ aspectRatio: "2/3", borderRadius: 5, overflow: "hidden", cursor: "pointer", border: playerAvatarCustom === src ? "2px solid #6ec6c6" : "1px solid #2a3a3a", background: "#0c0e14" }}
                >
                  <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.currentTarget.style.display = "none"; }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ cursor: "pointer", fontSize: "11.5px", color: "#6ec6c6", padding: "6px 12px", border: "1px solid #1a2d2a", borderRadius: 4 }}>
                ⬆ 上传图片
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = reader.result;
                      setPlayerAvatarCustom(dataUrl);
                      try { localStorage.setItem("qucuo_player_avatar", dataUrl); } catch { alert("图片太大，无法存入本地存储，请换小一点的图。"); }
                      setShowAvatarPicker(false);
                    };
                    reader.readAsDataURL(file);
                  }} />
              </label>
              {playerAvatarCustom && (
                <span onClick={() => { setPlayerAvatarCustom(""); try { localStorage.removeItem("qucuo_player_avatar"); } catch { /* ignore */ } setShowAvatarPicker(false); }}
                  style={{ cursor: "pointer", fontSize: "11.5px", color: "#c47070", padding: "6px 12px", border: "1px solid #3a1a1a", borderRadius: 4 }}>
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
