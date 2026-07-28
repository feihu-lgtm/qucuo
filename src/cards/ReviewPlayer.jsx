// 入册审改 · 作为玩家自己
// ============================================================================
// 字段顺序照「导入映射表 · 作为玩家」来，一项不落：
//   名字 / 性别 / 体貌公开层七项 / 体貌私密层五项 / 性格（丢） / 出身背景 /
//   说话风格示范 / 开场白 / 世界观地理规则 / 七维 / 内外功 / 气血
//
// 两条硬规矩写在这里：
//   · 私密层五项只允许手填，不接 AI 抽取。中文卡池里动漫角色占绝大多数，让
//     导入器自动从卡里抽「身体细节／敏感处」等于批量给未成年角色生成身体描写。
//     这不是可配置项。
//   · 卡的 personality 一律丢弃。玩家的性格由每轮输入实时表达，写死会跟实际
//     操作打架——你打「我冷笑一声」，卡里写着「温和有礼」，两句话互相拆台。

import React from "react";
import {
  BODY_PUBLIC, BODY_PRIVATE, TIERS, StatRow, SevenDim, Src, TextField,
  Section, Note, Pills, selStyle,
} from "./ReviewParts.jsx";
import { TIER_NEIGONG } from "./scanPrompts.js";
import { hpFromNeigong } from "../npcGeneration.js";

export default function ReviewPlayer({
  player, onPatch, accent,
  opening, onPatchOpening,
  worldCandidates, onPatchWorld,
  cardPersonality, cardMesExample,
}) {
  const p = player;
  const bp = p.bodyProfile || {};
  const priv = p.bodyProfilePrivate || {};
  const neigong = Number.isFinite(p.neigong) ? p.neigong : 5;
  const waigong = Number.isFinite(p.waigong) ? p.waigong : 5;
  const maxHp = hpFromNeigong(neigong, p.special?.体魄 ?? 5);
  const publicFilled = BODY_PUBLIC.filter(([k]) => (bp[k] || "").trim()).length;
  const privFilled = BODY_PRIVATE.filter(([k]) => (priv[k] || "").trim()).length;

  const setBody = (k, v) => onPatch({ bodyProfile: { ...bp, [k]: v } });
  const setPriv = (k, v) => onPatch({ bodyProfilePrivate: { ...priv, [k]: v } });

  return (
    <>
      {/* 1 名字 · 2 性别 */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <TextField label={<>名讳<Src source={p.source} why={p.nameWhy} /></>}
            value={p.name} max={12} onChange={v => onPatch({ name: v })} />
        </div>
        <div style={{ width: 200 }}>
          <div style={{ fontSize: 10.5, color: "#8a8270", marginBottom: 3, textAlign: "center" }}>
            性别<Src source="manual" />
          </div>
          <Pills accent={accent} value={p.gender || "男"} onChange={v => onPatch({ gender: v })}
            options={["男", "女", "其他"]} />
        </div>
      </div>

      {/* 3 体貌公开层 */}
      <Section title={<>体貌 · 公开层<span style={{ fontSize: 10, color: "#8a8270", marginLeft: 6 }}>{publicFilled}/7 项</span></>}>
        {BODY_PUBLIC.map(([k, label]) => (
          <TextField key={k} label={label} max={40} placeholder="留空由你自己填"
            value={bp[k]} onChange={v => setBody(k, v)} />
        ))}
        <Note tone="info">这七项在近距离互动的回合会注入给说书人，赶路那种回合自动灭灯，不占篇幅。</Note>
      </Section>

      {/* 4 体貌私密层 */}
      <Section title={<>体貌 · 私密层<Src source="manual" /><span style={{ fontSize: 10, color: "#8a8270", marginLeft: 6 }}>{privFilled}/5 项</span></>}>
        {BODY_PRIVATE.map(([k, label]) => (
          <TextField key={k} label={label} max={40} placeholder="只能你自己填"
            value={priv[k]} onChange={v => setPriv(k, v)} />
        ))}
        <Note tone="warn">
          这五项不从卡里抽，只能手填。卡池里动漫角色占绝大多数，自动抽取等于批量给
          未成年角色生成身体描写，所以这条是硬性的、没有开关。填了也只在 ■ 模式开启时注入。
        </Note>
      </Section>

      {/* 5 性格（丢弃） */}
      <Section title={<>性格<Src source="drop" /></>} dim>
        {cardPersonality ? (
          <div style={{
            fontSize: 10.5, lineHeight: 1.7, color: "#7a6a60", maxHeight: 76, overflowY: "auto",
            padding: "6px 8px", background: "rgba(0,0,0,.28)", border: "1px solid #2a2419", borderRadius: 3,
          }}>{cardPersonality}</div>
        ) : (
          <div style={{ fontSize: 10.5, color: "#6a6250" }}>这张卡没写 personality。</div>
        )}
        <Note tone="info">
          卡的性格字段一律不导入。你的性格由每轮输入实时表达——写死了会跟实际操作打架，
          比如你打「我冷笑一声」而卡里写着「温和有礼」。这段留在这里只供你参考。
        </Note>
      </Section>

      {/* 6 出身背景 */}
      <Section title="出身与来历（注入 7 号位，不外显）">
        <TextField label={null} rows={4} max={200} value={p.persona}
          onChange={v => onPatch({ persona: v })} />
      </Section>

      {/* 7 说话风格示范 */}
      <Section title="说话风格示范（注入 9 号位）">
        {cardMesExample ? (
          <>
            <TextField label={null} rows={5} value={p.dialogueExamples ?? cardMesExample}
              onChange={v => onPatch({ dialogueExamples: v })} />
            <Note tone="info">
              取自卡的 mes_example。本作的 9 号位一直是空的，这段进去正好当你的说话风格参考。
              不想用就清空。
            </Note>
          </>
        ) : (
          <div style={{ fontSize: 10.5, color: "#6a6250" }}>这张卡没写 mes_example，此项留空。</div>
        )}
      </Section>

      {/* 8 开场白 */}
      {opening && (
        <Section title={<>开场白{opening.source === "ai" ? <Src source="ai" why="已归化人称与文体" /> : <Src source="fallback" />}</>}>
          <TextField label={null} rows={6} value={opening.rewritten}
            onChange={v => onPatchOpening({ ...opening, rewritten: v })} />
          {opening.source === "ai" && opening.original !== opening.rewritten && (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 10.5, color: "#6a6250" }}>看原文对照</summary>
              <div style={{ fontSize: 10.5, lineHeight: 1.7, color: "#6a6250", whiteSpace: "pre-wrap", marginTop: 6 }}>
                {opening.original}
              </div>
            </details>
          )}
        </Section>
      )}

      {/* 9 世界观、地理、规则 */}
      <Section title={<>世界观 · 地理 · 规矩<span style={{ fontSize: 10, color: "#8a8270", marginLeft: 6 }}>{(worldCandidates || []).filter(w => w.on !== false).length}/{(worldCandidates || []).length} 条</span></>}>
        {!worldCandidates?.length ? (
          <div style={{ fontSize: 10.5, color: "#6a6250" }}>这张卡里没有地理／势力／规矩类条目。</div>
        ) : (
          <>
            {worldCandidates.map((w, i) => (
              <div key={i} onClick={() => onPatchWorld(i, { on: w.on === false })}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "5px 8px", marginBottom: 3,
                  cursor: "pointer", borderRadius: 3,
                  border: `1px solid ${w.on === false ? "#2a2419" : "#4a4028"}`,
                  background: w.on === false ? "transparent" : "rgba(212,168,83,.08)",
                }}>
                <span style={{ color: w.on === false ? "#4a4436" : accent, fontSize: 11 }}>
                  {w.on === false ? "○" : "◉"}
                </span>
                <span style={{ color: "#c8bfa0", fontSize: 11, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {w.label}
                </span>
                <span style={{ color: "#6a6250", fontSize: 9.5 }}>{w.kind} · {(w.content || "").length}字</span>
              </div>
            ))}
            <Note tone="info">
              勾上的会拼进剧本的世界观分段，跟本作原有的地理概要一起走分条点灯——
              只在玩家或上一轮回复提到相关词时才亮，不会每轮全量塞。
            </Note>
          </>
        )}
      </Section>

      {/* 10 七维 */}
      <Section title={<>七维天赋<Src source={p.source} why={p.specialWhy} /></>}>
        <SevenDim special={p.special} onChange={s => onPatch({ special: s })} />
      </Section>

      {/* 11 内外功 · 12 气血 */}
      <Section title="内功与外功">
        <StatRow label="内功" value={neigong} max={100} width={30} onChange={v => onPatch({ neigong: v })} />
        <StatRow label="外功" value={waigong} max={100} width={30} onChange={v => onPatch({ waigong: v })} />
        <div style={{ fontSize: 10, color: "#6a6250", marginTop: 4, lineHeight: 1.7 }}>
          开局默认都是 5（白档基准 {TIER_NEIGONG[0]}），往后靠花潜能修炼。
          气血由内功与体魄算出：<span style={{ color: "#d4a853" }}>{maxHp}</span>，不单独设。
        </div>
        <Note tone="info">调高这两项等于开局就带一身功夫。想从零开始就别动它。</Note>
      </Section>
    </>
  );
}
