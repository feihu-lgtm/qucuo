// 设置项「行动识别」：默认关闭，评测达标前只作实验开关。
export default function IntentRecognitionToggle({ cfg, patch }) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <input type="checkbox" id="intentRecognitionEnabled" checked={!!cfg.intentRecognitionEnabled}
          onChange={(e) => patch({ intentRecognitionEnabled: e.target.checked })} style={{ cursor: "pointer" }} />
        <label htmlFor="intentRecognitionEnabled" style={{ fontSize: "12px", color: "var(--accent)", cursor: "pointer", userSelect: "none" }}>
          行动识别（实验）
        </label>
      </div>
      <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginBottom: 8, lineHeight: 1.5 }}>
        开启后：自由输入先由模型识别成结构化行动（送礼、购买、切磋、拜师、移动、用物品），系统逐步核对银两、人物、物品后再执行；
        把握不足时先问一句确认，识别不出就按原来的自由行动处理。
      </div>
    </div>
  );
}
