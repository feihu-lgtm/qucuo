// 版本历史面板（可复用）
// ============================================================================
// 从 MudRPG.jsx 原有的"📅版本历史"弹窗抽出来的独立组件，供发布页封面
// （StartScreen.jsx）和游戏内页（MudRPG.jsx）共用同一份渲染逻辑 + 同一个数据源
// （version.js 的 VERSION_HISTORY）。之所以要抽成独立组件而不是在封面页另写一份
// 样式相近的按钮，是因为"和内页统一"这个要求的本质是"同一份代码、同一份数据"，
// 不是"看起来差不多"——抽公共组件才能保证以后改一处两边同步生效，不会出现
// 封面页版本号跟内页对不上的情况。
//
// VERSION_HISTORY 里的 time 字段是手写的东八区时间字符串（如 "2026-07-26 14:00"），
// 本组件不做任何时区计算或动态时间渲染，原样显示这份数据——保证不管玩家在哪个
// 时区打开游戏，看到的版本时间戳都是一致的东八区时间，不会因为本地时区不同而
// 显示出不一样的数字。
// ============================================================================
import React from "react";
import { VERSION_HISTORY } from "./version.js";
import { useOverlayCloseGuard } from "./utils/overlayClose.js";

export default function VersionHistoryPanel({ onClose, accentDim = "#c8323a" }) {
  const closeGuard = useOverlayCloseGuard(onClose);
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(4,4,10,0.92)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onMouseDown={closeGuard.onMouseDown} onClick={closeGuard.onClick}>
      <div style={{ background: "#111110", border: "1px solid #4a453c", borderRadius: 0, padding: 20, width: 420, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto", fontSize: "12px", color: "#e8e4d6" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: "#c8323a", fontSize: "14px" }}>版本历史</span>
          <span style={{ color: "#8f8a7c", fontSize: "11px", cursor: "pointer" }} onClick={onClose}>× 关闭</span>
        </div>
        {VERSION_HISTORY.map((v, i) => (
          <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < VERSION_HISTORY.length - 1 ? "1px solid #14161e" : "none" }}>
            <div style={{ color: i === 0 ? "#d68a8a" : "#e8e4d6", fontSize: "12.5px" }}>「{v.codename}」{i === 0 && <span style={{ color: accentDim, fontSize: "10px" }}> · 当前版本</span>}</div>
            <div style={{ color: "#8f8a7c", fontSize: "10.5px", marginBottom: 4 }}>{v.time}</div>
            {/* notes 两种写法都认：数组=一行一条逐行列出（长条目请写数组）；
                字符串=老写法，整段显示。数组里以 ①②③ 或 一、二、开头的行
                悬挂缩进一下，看起来才像个更新日志而不是一堵墙。 */}
            {Array.isArray(v.notes) ? (
              <div style={{ display: "grid", gap: 3 }}>
                {v.notes.map((line, j) => {
                  const isItem = /^[①-⑳【]|^[一二三四五六七八九十]、/.test(String(line).trim());
                  return (
                    <div key={j} style={{
                      color: isItem ? "#8f8a7c" : "#a09a86",
                      fontSize: "11px", lineHeight: 1.65,
                      paddingLeft: isItem ? 12 : 0,
                      textIndent: isItem ? -12 : 0,
                    }}>{line}</div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: "#8f8a7c", fontSize: "11px", lineHeight: 1.6 }}>{v.notes}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
