// 地宫节点展示与选项渲染（纯展示，零全局 store 依赖）。
import React from "react";
import { DUNGEON_NODE_TYPE } from "../../../domain/data/dungeon/catalog.js";
import { calcDungeonCheckRate, computeSettledLoot } from "../../../domain/rules/dungeon/engine.js";
import { THEME_VARS, chromeBtn } from "../../../utils/theme.js";

const NODE_BADGE = {
  [DUNGEON_NODE_TYPE.TRAP]: "机关",
  [DUNGEON_NODE_TYPE.COMBAT]: "守卫",
  [DUNGEON_NODE_TYPE.EVENT]: "奇遇",
  [DUNGEON_NODE_TYPE.TREASURE]: "秘宝",
  [DUNGEON_NODE_TYPE.REST]: "休整",
  [DUNGEON_NODE_TYPE.ADVENTURER]: "冒险者",
  [DUNGEON_NODE_TYPE.BOSS]: "首领",
};

function renderNodeTitle(node) {
  const adv = node?.adventurer;
  if (!adv) return node.title;
  const prefix = node.title.split("·")[0]?.trim() || "江湖奇遇";
  const cls = `adventurer-rainbow adventurer-rainbow--${adv.rainbowStyle || "prism"}`;
  return (
    <span>
      {prefix} · <span className={cls}>{adv.name}</span>
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginLeft: 6 }}>
        {adv.title} · {adv.archetypeLabel}
      </span>
    </span>
  );
}

const cardStyle = () => ({
  border: `1px solid var(--border)`,
  background: "var(--bg-panel)",
  padding: "10px 12px",
  marginBottom: 8,
});

export default function DungeonNodeView({
  run, effectiveSpecialNow, narration,
  onSelectNode, onChoose, onRetreat, onSettleClose,
}) {
  if (run.status === "victory" || run.status === "retreated" || run.status === "defeated") {
    const settled = computeSettledLoot(run);
    const title = run.status === "victory"
      ? "通关秘室 · 满载而归"
      : run.status === "retreated"
        ? "稳步撤退 · 保留全部收获"
        : "负伤脱身 · 银两折半保命";
    return (
      <div style={cardStyle()}>
        <div style={{ color: "var(--accent)", fontSize: "var(--fs-md)", marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-dim)", marginBottom: 8 }}>
          已探节点 {run.clearedNodes} 处 · 剩余气血 {Math.max(1, run.hp[0])}/{run.hp[1]}
        </div>
        <div style={{ fontSize: "var(--fs-sm)", lineHeight: 1.7, marginBottom: 10 }}>
          <div>银两：+{settled.money} 两</div>
          <div>江湖经验：+{settled.exp} · 武学潜能：+{settled.pot}</div>
          <div>
            带出物事：{settled.items.length ? settled.items.join("、") : "无"}
          </div>
          {run.usedItems.length > 0 && (
            <div style={{ color: "var(--text-dim)" }}>消耗品：{run.usedItems.join("、")}</div>
          )}
        </div>
        <button type="button" onClick={onSettleClose} style={chromeBtn(THEME_VARS, { active: true })}>
          收起战利品离开
        </button>
      </div>
    );
  }

  if (run.status === "node" && run.activeNode) {
    const node = run.activeNode;
    return (
      <div style={cardStyle()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ color: "var(--accent)", fontSize: "var(--fs-md)" }}>{renderNodeTitle(node)}</span>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--accent-dim)" }}>
            [{NODE_BADGE[node.type] || "节点"}]
          </span>
        </div>
        {node.adventurer && (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginBottom: 6 }}>
            {node.adventurer.personality}
          </div>
        )}
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--text)", lineHeight: 1.6, marginBottom: 10 }}>
          {node.desc}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(node.choices || []).map((choice) => {
            const statVal = choice.stat ? (effectiveSpecialNow?.[choice.stat] ?? 5) : null;
            const rate = choice.stat ? calcDungeonCheckRate(statVal, choice.dc ?? 5) : null;
            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => onChoose(choice.id)}
                style={{ ...chromeBtn(THEME_VARS), textAlign: "left", padding: "7px 10px" }}
              >
                <div>{choice.label}</div>
                {choice.stat && (
                  <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-dim)", marginTop: 2 }}>
                    检定：{choice.stat}（当前 {statVal} / 难度 {choice.dc ?? 5} · 胜算 {rate}%）
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {narration && (
        <div style={{
          ...cardStyle(),
          borderStyle: "dashed",
          fontSize: "var(--fs-sm)",
          color: "var(--text-dim)",
          lineHeight: 1.6,
        }}>
          {narration}
        </div>
      )}
      <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-dim)", marginBottom: 6 }}>
        选择前方去路：
      </div>
      {(run.choices || []).map((node) => (
        <div key={node.nodeId} style={cardStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ color: "var(--accent)", fontSize: "var(--fs-md)" }}>{renderNodeTitle(node)}</span>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--accent-dim)" }}>
              {NODE_BADGE[node.type] || "节点"}
            </span>
          </div>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-dim)", lineHeight: 1.55, marginBottom: 8 }}>
            {node.desc}
          </div>
          <button
            type="button"
            onClick={() => onSelectNode(node.nodeId)}
            style={chromeBtn(THEME_VARS)}
          >
            {node.type === DUNGEON_NODE_TYPE.COMBAT || node.type === DUNGEON_NODE_TYPE.BOSS
              ? "迎战"
              : "上前查看"}
          </button>
        </div>
      ))}
      <div style={{ marginTop: 8 }}>
        <button type="button" onClick={onRetreat} style={chromeBtn(THEME_VARS)}>
          见好就收 · 撤出地宫
        </button>
      </div>
    </div>
  );
}
