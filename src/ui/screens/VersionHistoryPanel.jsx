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
import React, { useEffect, useState } from "react";
import { loadVersionHistory } from "../../utils/version.js";
import ModalShell from "../primitives/ModalShell.jsx";

export default function VersionHistoryPanel({ onClose, accentDim = "var(--accent)" }) {
  // 485KB 的完整历史不进主包：弹窗点开才动态 import。
  const [history, setHistory] = useState(null);
  useEffect(() => {
    let live = true;
    loadVersionHistory().then((entries) => { if (live) setHistory(entries); });
    return () => { live = false; };
  }, []);
  const VERSION_HISTORY = history || [];
  return (
    <ModalShell
      title="版本历史"
      onClose={onClose}
      closeLabel="关闭版本历史"
      layer="top"
      panelClassName="version-history-panel"
      panelStyle={{ width: 420, maxHeight: "80vh" }}
    >
      {VERSION_HISTORY.map((v, i) => (
        <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < VERSION_HISTORY.length - 1 ? "1px solid var(--bg-slate)" : "none" }}>
          <div style={{ color: i === 0 ? "var(--pink)" : "var(--ink-text)", fontSize: "var(--fs-md)" }}>{v.version ? `${v.version} ` : ""}「{v.codename}」{i === 0 && <span style={{ color: accentDim, fontSize: "var(--fs-2xs)" }}> · 当前版本</span>}</div>
          <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", marginBottom: 4 }}>{v.time}</div>
          {/* notes 两种写法都认：数组=一行一条逐行列出（长条目请写数组）；
              字符串=老写法，整段显示。数组里以 ①②③ 或 一、二、开头的行
              悬挂缩进一下，看起来才像个更新日志而不是一堵墙。 */}
          {Array.isArray(v.notes) ? (
            <div style={{ display: "grid", gap: 3 }}>
              {v.notes.map((line, j) => {
                const isItem = /^[①-⑳【]|^[一二三四五六七八九十]、/.test(String(line).trim());
                return (
                  <div key={j} style={{
                    color: isItem ? "var(--text-dim)" : "var(--tavern-steam)",
                    fontSize: "var(--fs-xs)", lineHeight: 1.65,
                    paddingLeft: isItem ? 12 : 0,
                    textIndent: isItem ? -12 : 0,
                  }}>{line}</div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: "var(--text-dim)", fontSize: "var(--fs-xs)", lineHeight: 1.6 }}>{v.notes}</div>
          )}
        </div>
      ))}
    </ModalShell>
  );
}
