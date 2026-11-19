import React from "react";

// 新手教程覆盖层：半透明遮罩铺满全屏，按三栏（左/中/右）+ 顶部 + 底部按钮区的
// 实际位置贴说明便签，指向它介绍的界面区域。点任意处或右上角最小化收起。
export default function TutorialOverlay({ onClose }) {
  const note = {
    background: "rgba(14,18,26,0.96)", border: "1px solid #6a5d40", borderRadius: 0,
    padding: "12px 16px", color: "#e8dcc0", fontSize: "12.5px", lineHeight: 1.7,
    boxShadow: "0 6px 24px rgba(0,0,0,0.6)", maxWidth: 260,
  };
  const title = { color: "#c8663a", fontWeight: "bold", fontSize: "13px", marginBottom: 6, display: "block" };
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(6,6,12,0.72)", cursor: "pointer",
        display: "flex", flexDirection: "column", fontFamily: "'Songti SC','STSong','SimSun',serif" }}
    >
      {/* 顶部提示条 */}
      <div style={{ textAlign: "center", padding: "14px 0 8px", color: "#f0e0c0", fontSize: "15px", fontWeight: "bold", letterSpacing: "1px" }}>
        📖 新手教程 · 界面导览
        <span style={{ display: "block", fontSize: "11px", color: "#b0a080", fontWeight: "normal", marginTop: 4 }}>点任意处收起（最小化）</span>
      </div>

      {/* 三栏说明便签，按 flex 25/55/30 的实际位置横向铺开 */}
      <div style={{ display: "flex", flex: 1, alignItems: "flex-start", padding: "0 14px", gap: 12, overflow: "hidden" }}>
        {/* 左栏 flex 25 */}
        <div style={{ flex: 25, display: "flex", justifyContent: "center", paddingTop: 20 }}>
          <div style={note}>
            <span style={title}>◀ 左栏 · 天地</span>
            你此刻在<b>哪里</b>、周围的<b>出口</b>、<b>此地之人</b>（谁在场）、你的<b>状态</b>（气血/银两/背包）和<b>小地图</b>都在这里。
            <div style={{ marginTop: 8, color: "#c0a86a" }}>🕐 一天 24 小时：每行动一次约走一个时辰，昼夜会变，时间显示在地点下方。</div>
            <div style={{ marginTop: 8, color: "#9ac0a0" }}>🚶 移动：在底部输入框打 <b>n/s/e/w</b>（北南东西），或点小地图上已探明的据点自动前往。</div>
            <div style={{ marginTop: 8, color: "#a0b8c0" }}>🗺️ <b>外层与内层</b>：外层是<b>大地图</b>（据点与据点之间，如鱼定村↔天都镇）；进了一个据点，内部又是一片<b>箱庭</b>——一个个可走动的内层房间（如村口、药铺、饭馆）。小地图右上角可切换<b>「外 / 内」</b>两层视图。</div>
          </div>
        </div>
        {/* 中栏 flex 55 */}
        <div style={{ flex: 55, display: "flex", justifyContent: "center", paddingTop: 60 }}>
          <div style={{ ...note, maxWidth: 340 }}>
            <span style={title}>▼ 中栏 · 江湖（叙事）</span>
            故事在这里展开——旁白的叙述、NPC 的<b>「对话」</b>、你的行动结果，都会一行行写在这块。这是游戏的<b>正文</b>，读它了解发生了什么。
            <div style={{ marginTop: 8, color: "#b0a080" }}>「」里是对话，*斜体*是心理活动，其余是旁白叙述。</div>
          </div>
        </div>
        {/* 右栏 flex 30 */}
        <div style={{ flex: 30, display: "flex", justifyContent: "center", paddingTop: 20 }}>
          <div style={note}>
            <span style={title}>▶ 右栏 · 行动</span>
            这里是<b>此刻能做的事</b>：可推进的<b>任务节点</b>（金色感叹号）、当前地点的<b>行动抉择</b>、<b>人物互动</b>入口。想推进剧情、跟人打交道，都从这一栏点。
          </div>
        </div>
      </div>

      {/* 底部按钮区说明，贴着底部（对应输入框上方那排模式按钮） */}
      <div style={{ padding: "0 14px 16px", display: "flex", justifyContent: "center" }}>
        <div style={{ ...note, maxWidth: 620 }}>
          <span style={title}>▼ 底部 · 交互模式（输入框上方那排按钮）</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
            <div><b style={{ color: "#c8323a" }}>◈ 行动</b>：正常移动、战斗、开箱、买卖等，<b>每次消耗一个回合</b>（时间前进）。</div>
            <div><b style={{ color: "#c07050" }}>◎ 对话</b>：只和当前在场 NPC 交谈，<b>不移动、不消耗回合</b>。</div>
            <div><b style={{ color: "#d68a8a" }}>◆ 私聊旁白</b>：打破第四面墙，直接和「旁白」说话，<b>不消耗回合</b>。</div>
            <div><b style={{ color: "#c85a6a" }}>NSFW</b>：开关。开启后注入成人向写作规则；关闭则为常规叙事。默认关闭，按需点亮。</div>
          </div>
          <div style={{ marginTop: 8, color: "#9a9080", fontSize: "11.5px" }}>
            ⬆️ <b>顶栏</b>（界面最上方一排）：<b>📜任务</b> 看接了什么任务、进度如何；<b>👥人物关系</b> 看各角色好感；<b>📖见闻录</b> 看已知世界情报。
          </div>
          <div style={{ marginTop: 6, color: "#9a9080", fontSize: "11.5px" }}>
            ⚙ <b>其他功能</b>：<b>⚙设置</b> 里配置 API 密钥、存档、字号；<b>💾存档</b>随时读写；<b>⏻主菜单</b>返回开始界面；<b>🧭全流程日志</b>看系统每一步怎么跑的（喂给 AI 的完整 prompt 和回复）。
          </div>
        </div>
      </div>
    </div>
  );
}
