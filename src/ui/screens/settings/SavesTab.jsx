import React from "react";
import { listSlots, saveToSlot, loadSlot, deleteSlot, clearAutoSave, autoSave, exportSave, importSave } from "../../../infra/saves.js";
import { setRngState, setSeed } from "../../../utils/rng.js";
import { clearInspectCache, inspectCacheSize } from "../../../infra/inspectCache.js";
import { inputStyle, labelStyle, sectionStyle, btnStyle } from "./styles.js";
import { downloadText, pickTextFile, ts } from "./fileIo.js";

// 存档管理 tab。slots/slotLabel 状态由壳持有（切 tab 回来不丢），本组件只做渲染与事件。
export default function SavesTab({ cfg, patch, dispatchCommand, currentSnapshot, onLoadSnapshot, slots, setSlots, slotLabel, setSlotLabel }) {
  const refreshSlots = () => setSlots(listSlots());

  const runCommand = (id, fn) => dispatchCommand ? dispatchCommand(id, fn) : fn();
  const runCommandWithAlert = (id, fn) => Promise.resolve(runCommand(id, fn)).then(result => {
    if (result?.status === "rejected" && result.message) alert(result.message);
    return result;
  });

  const handleManualSave = () => runCommand("save", () => {
    if (!currentSnapshot) return;
    saveToSlot(currentSnapshot(), slotLabel.trim() || undefined);
    setSlotLabel("");
    refreshSlots();
  });

  const handleLoadSlot = (id) => runCommandWithAlert("load", () => {
    const snap = loadSlot(id); if (!snap) return;
    onLoadSnapshot(snap); if (!setRngState(snap.rngState)) setSeed(Date.now());
  });

  const handleDeleteSlot = (id) => runCommand("save", () => { deleteSlot(id); refreshSlots(); });

  return (
    <div>
      <div style={labelStyle}>手动存档</div>
      <div style={{ display: "flex", gap: 6 }}>
        <input style={{ ...inputStyle, flex: 1 }} value={slotLabel} onChange={e => setSlotLabel(e.target.value)} placeholder="存档名称（留空自动生成）" />
        <span style={btnStyle} onClick={handleManualSave}>保存当前进度</span>
      </div>

      {/* 存档落盘：把当前进度导出成 .json 文件，或从文件导入 */}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <span style={{ ...btnStyle, flex: 1, textAlign: "center" }} onClick={() => {
          if (!currentSnapshot) return;
          const snap = currentSnapshot();
          downloadText(`曲措乡-存档-${ts()}.json`, exportSave(snap, slotLabel.trim() || undefined));
        }}>⬇ 导出当前进度到文件</span>
        <span style={{ ...btnStyle, flex: 1, textAlign: "center" }} onClick={() => pickTextFile((text) => runCommand("save", () => {
          try { importSave(text); refreshSlots(); alert("已导入存档，可在下方槽位读取。"); }
          catch (e) { alert("导入失败：" + e.message); }
        }))}>⬆ 从文件导入存档</span>
      </div>

      <div style={{ ...sectionStyle }}>
        <div style={labelStyle}>自动存档</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>每</span>
          <input
            type="number" min="0" max="99"
            style={{ ...inputStyle, width: 64 }}
            value={cfg.autoSaveEvery ?? 5}
            onChange={e => patch({ autoSaveEvery: Math.max(0, Math.min(99, parseInt(e.target.value) || 0)) })}
          />
          <span style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>回合写一次自动存档（0 = 每回合都写）</span>
        </div>
        <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: 6, marginBottom: 8 }}>
          关闭或刷新页面时会自动补写一次，不会丢最近几回合。间隔越大写入越省，回档最多丢对应回合数。
        </div>
        <span
          style={btnStyle}
          onClick={() => runCommand("save", () => {
            if (!currentSnapshot) return;
            const r = autoSave(currentSnapshot());
            alert(r.ok ? "已立即写入自动存档" : `写入失败：${r.error}`);
          })}
        >💾 立即写入自动存档</span>
      </div>

      <div style={{ ...sectionStyle }}>
        <div style={labelStyle}>存档槽位（{slots.length}）</div>
        {slots.length === 0 && <div style={{ color: "var(--ink-dim-deep)" }}>暂无手动存档</div>}
        {slots.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--bg-slate)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "var(--text)" }}>{s.label}</div>
              <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>{s.presetName} · {new Date(s.savedAt).toLocaleString()}</div>
            </div>
            <span style={{ ...btnStyle, padding: "3px 8px" }} onClick={() => handleLoadSlot(s.id)}>读取</span>
            <span style={{ ...btnStyle, padding: "3px 8px" }} onClick={() => {
              const snap = loadSlot(s.id);
              if (snap) downloadText(`曲措乡-${s.label}-${ts()}.json`, exportSave(snap, s.label));
            }}>导出</span>
            <span style={{ ...btnStyle, padding: "3px 8px", color: "var(--red-soft)" }} onClick={() => handleDeleteSlot(s.id)}>删除</span>
          </div>
        ))}
      </div>

      <div style={{ ...sectionStyle, fontSize: "10.5px", color: "var(--text-dim)" }}>
        自动存档按上面设定的回合间隔写入，刷新页面后会自动读取。
        进入游戏时如果看到"已从上次自动存档恢复进度"的提示，说明这次是接着上次玩的。
      </div>

      <div style={{ ...sectionStyle }}>
        <div style={labelStyle}>查看缓存</div>
        <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginBottom: 8 }}>
          "查看武学/物品"的说书人描述文本会缓存在本地（当前 {inspectCacheSize()} 条），
          同一件东西只调用一次 LLM，之后再看直接读缓存，秒开且不耗 token。
          除非改了描述生成规则想强制刷新，否则不需要清空。
        </div>
        <span
          style={{ ...btnStyle, color: "var(--gold)", borderColor: "var(--ink-edge-gold)" }}
          onClick={() => {
            if (window.confirm("确定清空「查看武学/物品」的缓存文本？下次查看时会重新调用 LLM 生成。")) {
              clearInspectCache();
              alert("已清空查看缓存");
            }
          }}
        >🗑 清空查看缓存</span>
      </div>

      <div style={{ ...sectionStyle }}>
        <span
          style={{ ...btnStyle, color: "var(--red-soft)", borderColor: "var(--ink-edge-red)" }}
          onClick={() => runCommandWithAlert("newGame", () => {
            if (window.confirm("确定要清空自动存档、从头开始吗？此操作不可撤销（手动存档槽位不受影响）。")) {
              clearAutoSave();
              window.location.reload();
            }
          })}
        >🗑 清空自动存档，重新开始</span>
      </div>
    </div>
  );
}
