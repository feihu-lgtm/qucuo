import React from "react";
import { listSlots, saveToSlot, loadSlot, deleteSlot, clearAutoSave, autoSave, exportSave, exportFullSave, importSave } from "../../../infra/saves.js";
import { loadStorageConfig, saveStorageConfig, setStorageDriver, getCloudConflicts, getCloudQueue, resolveCloudConflict, wipeCloudAll, flushCloudQueue } from "../../../infra/storageDriver.js";
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
          void exportFullSave(snap, slotLabel.trim() || undefined).then((text) => downloadText(`曲措乡-存档-${ts()}.json`, text));
        }}>⬇ 导出当前进度到文件</span>
        <span style={{ ...btnStyle, flex: 1, textAlign: "center" }} onClick={() => pickTextFile((text) => runCommand("save", () => {
          try { importSave(text); refreshSlots(); alert("已导入存档，可在下方槽位读取。"); }
          catch (e) { alert("导入失败：" + e.message); }
        }))}>⬆ 从文件导入存档</span>
      </div>

      <div style={{ ...sectionStyle }}>
        <div style={labelStyle}>自动存档</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-dim)" }}>每</span>
          <input
            type="number" min="0" max="99"
            style={{ ...inputStyle, width: 64 }}
            value={cfg.autoSaveEvery ?? 5}
            onChange={e => patch({ autoSaveEvery: Math.max(0, Math.min(99, parseInt(e.target.value) || 0)) })}
          />
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-dim)" }}>回合写一次自动存档（0 = 每回合都写）</span>
        </div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 6, marginBottom: 8 }}>
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
              <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)" }}>{s.presetName} · {new Date(s.savedAt).toLocaleString()}</div>
            </div>
            <span style={{ ...btnStyle, padding: "3px 8px" }} onClick={() => handleLoadSlot(s.id)}>读取</span>
            <span style={{ ...btnStyle, padding: "3px 8px" }} onClick={() => {
              const snap = loadSlot(s.id);
              if (snap) void exportFullSave(snap, s.label).then((text) => downloadText(`曲措乡-${s.label}-${ts()}.json`, text));
            }}>导出</span>
            <span style={{ ...btnStyle, padding: "3px 8px", color: "var(--red-soft)" }} onClick={() => handleDeleteSlot(s.id)}>删除</span>
          </div>
        ))}
      </div>

      <div style={{ ...sectionStyle, fontSize: "var(--fs-xs)", color: "var(--text-dim)" }}>
        自动存档按上面设定的回合间隔写入，刷新页面后会自动读取。
        进入游戏时如果看到"已从上次自动存档恢复进度"的提示，说明这次是接着上次玩的。
      </div>

      <StorageDriverSection />

      <div style={{ ...sectionStyle }}>
        <div style={labelStyle}>查看缓存</div>
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 8 }}>
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

// ── 存储驱动三档（WO-19）────────────────────────────────────────────
// local 默认离线可玩；cloud 双写+推送 seam（服务端 WO-20 未部署，推送仅入队/退避
// 客户端逻辑真实生效）；file 走上方导入导出。云冲突绝不自动覆盖，必须玩家显式裁决。
export function StorageDriverSection() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  const cfg = loadStorageConfig();
  const conflicts = getCloudConflicts();
  const queueLen = getCloudQueue().length;
  const patchCfg = (kv) => { saveStorageConfig({ ...loadStorageConfig(), ...kv }); force(); };

  return (
    <div style={{ ...sectionStyle }} data-testid="storage-driver-section">
      <div style={labelStyle}>存档存储方式</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        {[["local", "本地（默认）"], ["cloud", "云端同步"], ["file", "文件备份"]].map(([k, label]) => (
          <span key={k} data-testid={`driver-${k}`}
            style={{ ...btnStyle, flex: 1, textAlign: "center", ...(cfg.driver === k ? { color: "var(--gold)", borderColor: "var(--ink-edge-gold)" } : {}) }}
            onClick={() => { setStorageDriver(k); force(); }}
          >{label}</span>
        ))}
      </div>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 8 }}>
        {cfg.driver === "local" && "存档只存在这台设备的浏览器里，离线可玩，换设备请用文件导出。"}
        {cfg.driver === "cloud" && "本地照存一份，同时排队推送到云服务。断网不丢，恢复后自动补推。云服务器尚未部署（后续工单），当前推送会在后台退避重试。"}
        {cfg.driver === "file" && "用上方「导出/导入」按钮手动备份整包（含回忆原文段落）。"}
      </div>
      {cfg.driver === "cloud" && (
        <div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
            <input style={{ ...inputStyle, flex: 1 }} defaultValue={cfg.cloudUrl} placeholder="云服务地址（如 https://saves.example.com）"
              onBlur={(e) => patchCfg({ cloudUrl: e.target.value.trim(), boundAt: e.target.value.trim() ? Date.now() : null })} />
          </div>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 6 }}>
            绑定状态：{cfg.cloudUrl ? `已绑定（设备 ${cfg.deviceId}）` : "未绑定"}　待推送队列：{queueLen} 条
            {queueLen > 0 && <span style={{ ...btnStyle, padding: "2px 6px", marginLeft: 6 }} onClick={() => { void flushCloudQueue().then(force); }}>立即推送</span>}
          </div>
          {conflicts.length > 0 && (
            <div style={{ marginBottom: 8 }} data-testid="cloud-conflicts">
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--red-soft)", marginBottom: 4 }}>
                云端与本地存档冲突（{conflicts.length}）——系统不会自动覆盖，请选择：
              </div>
              {conflicts.map((c) => (
                <div key={c.key} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ flex: 1, fontSize: "var(--fs-xs)", color: "var(--text)" }}>{c.key}</span>
                  <span style={{ ...btnStyle, padding: "2px 6px" }} onClick={() => { resolveCloudConflict(c.key, "keep_local"); force(); }}>用本地覆盖云端</span>
                  <span style={{ ...btnStyle, padding: "2px 6px" }} onClick={() => { resolveCloudConflict(c.key, "keep_cloud"); force(); }}>放弃本次推送</span>
                </div>
              ))}
            </div>
          )}
          <span style={{ ...btnStyle, color: "var(--red-soft)" }} data-testid="wipe-cloud"
            onClick={() => {
              if (!window.confirm("确定抹除云端全部存档与记忆？此操作不可撤销。")) return;
              if (!window.confirm("再确认一次：云端数据将被彻底删除，本地存档不受影响。继续？")) return;
              void wipeCloudAll().then((r) => { alert(r.ok ? "云端抹除请求已发送" : `抹除失败：${r.reason}`); force(); });
            }}
          >🗑 一键彻底抹除云端全部存档与记忆</span>
        </div>
      )}
    </div>
  );
}
