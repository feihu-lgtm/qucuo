// 入册审改 · 作为 NPC
// ============================================================================
// 字段顺序照「导入映射表 · 作为 NPC」来，一项不落：
//   角色名 / 别名 / 一句话身份 / 人设正文 / 外貌锚点 / 好感初值 / 好感里程碑 /
//   NSFW 段 / 品阶 / 内外功 / 七维 / 气血 / 随身物 / 招式 / 立绘 / 落脚 /
//   已丢弃的（状态栏格式、前端脚本）
//
// 标 ⚠ 的四项（品阶、随身物、招式、内外功七维）卡里根本没有，是 AI 抽的草案或
// 默认值，所以每项都带来源标记与判断依据——没有依据的话玩家只能盲信。
//
// 本文件只留主面板；招式/随身物/原卡对照/立绘/落脚各成文件，共享常量在
// reviewShared.js。
import React from "react";
import {
  JadeTier, Note, Pills, Section, SevenDim, Src, StatRow, TIERS, TextField, selStyle,
} from "./widgets.jsx";
import { LORE_MAX, TIER_NEIGONG } from "../../../domain/rules/cards/scanPrompts.js";
import { hpFromNeigong, atkFromWaigong } from "../../../domain/rules/npc/npcGeneration.js";
import MoveEditor from "./MoveEditor.jsx";
import CarryPicker from "./CarryPicker.jsx";
import RawEntryCompare from "./RawEntryCompare.jsx";
import PortraitPicker from "./PortraitPicker.jsx";
import Placement from "./Placement.jsx";

// ── 主体 ──────────────────────────────────────────────────────────────────────

export default function ReviewNpc({ npc, onPatch, accent, dropped, apiCfg, cardImage, currentDistrict }) {
  const n = npc;
  const cap = n.levelCap ?? 1;
  const neigong = Number.isFinite(n.neigong) ? n.neigong : (TIER_NEIGONG[cap] ?? 23);
  const waigong = Number.isFinite(n.waigong) ? n.waigong : (TIER_NEIGONG[cap] ?? 23);
  // 气血与攻击都是算出来的，不给改——改了会跟战斗结算里的公式打两套账
  const maxHp = hpFromNeigong(neigong, n.special?.体魄 ?? 5);
  const atk = typeof atkFromWaigong === "function" ? atkFromWaigong(waigong) : null;

  return (
    <>
      {/* 1 角色名 · 2 别名 · 3 一句话身份 */}
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ flexShrink: 0, textAlign: "center" }}>
          <JadeTier value={cap} size={54} withSelect onChange={v => onPatch({ levelCap: v })} />
          <div style={{ fontSize: 10, color: "var(--ink-muted)", marginTop: 5 }}>
            品阶<Src source={n.source} why={n.levelCapWhy} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <TextField label="角色名" value={n.name} max={12} onChange={v => onPatch({ name: v })} />
            </div>
            <div style={{ width: 92 }}>
              <TextField label={<>初始好感<Src source={n.source} why={n.affectionWhy} /></>}
                value={String(n.affection ?? 0)}
                onChange={v => onPatch({ affection: Math.max(-20, Math.min(20, Number(v) || 0)) })} />
            </div>
          </div>
          <TextField label={<>一句话身份<Src source={n.source} why={n.briefWhy} /></>}
            value={n.brief} max={15} onChange={v => onPatch({ brief: v })} />
          <TextField label="别名、称谓（顿号分隔，用于对话里认出他）"
            value={(n.aliases || []).join("、")}
            onChange={v => onPatch({ aliases: v.split(/[、,，]/).map(s => s.trim()).filter(Boolean) })} />
        </div>
      </div>

      {/* 4 人设正文 */}
      <Section title={<>
        人设正文（注入 2／6 号位，不外显）
        {n.entryFromAi
          ? <Src source="ai" why="按本作格式重写过" />
          : <Src source="fallback" />}
        <span style={{ fontSize: 10, color: (n.entry || "").length > LORE_MAX ? "#d89080" : "var(--ink-muted)", marginLeft: 6 }}>
          {(n.entry || "").length}/{LORE_MAX} 字
        </span>
      </>}>
        <TextField label={null} rows={5} max={LORE_MAX}
          value={n.entry} onChange={v => onPatch({ entry: v })} />

        {n.entryFromAi ? (
          <Note tone="info">
            这段是 AI 按本作格式重写过的：第三人称、只写性格与行为、剥掉了原卡的小标题与
            占位符。外貌与初见态度各有专门字段承接，所以这里不该再出现。对照下面的原文改。
          </Note>
        ) : n.rawEntry ? (
          <Note tone="warn">
            AI 没出重写版，这段是原卡正文清洗后顶上的——占位符与行首小标题已剥掉、压成了单行，
            但第二人称「你」、外貌重复、说话例句这些还在。建议照下面的原文自己改一遍。
          </Note>
        ) : null}

        {n.rawEntry ? <RawEntryCompare raw={n.rawEntry} /> : null}
      </Section>

      {/* 5 外貌锚点 */}
      <Section title="外貌锚点与初见态度">
        <TextField label="别人一眼看得见的" rows={3} max={100}
          value={n.appearance} onChange={v => onPatch({ appearance: v })} />
        <TextField label="初次照面的态度与说话方式" rows={2} max={50}
          value={n.attitude} onChange={v => onPatch({ attitude: v })} />
      </Section>

      {/* 6-7 好感里程碑 */}
      <Section title="好感里程碑（本作只有 30 / 60 两档）">
        {(n.milestones || []).map((m, mi) => (
          <div key={m.threshold} style={{ marginBottom: 9, paddingBottom: 8, borderBottom: "1px dashed var(--bg-card)" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <span style={{ width: 26, fontSize: 12, color: accent, flexShrink: 0 }}>{m.threshold}</span>
              <input value={m.title} placeholder="标题"
                onChange={e => onPatch({ milestones: n.milestones.map((x, j) => j === mi ? { ...x, title: e.target.value.slice(0, 8) } : x) })}
                style={{ ...selStyle, width: 76 }} />
              <input value={m.brief} placeholder="一句话说明"
                onChange={e => onPatch({ milestones: n.milestones.map((x, j) => j === mi ? { ...x, brief: e.target.value.slice(0, 30) } : x) })}
                style={{ ...selStyle, flex: 1 }} />
            </div>
            <textarea rows={2} value={(m.text || []).join("\n")}
              placeholder="领取这段剧情时玩家会读到的正文，一行一句。留空则领取后无内容"
              onChange={e => onPatch({ milestones: n.milestones.map((x, j) => j === mi ? { ...x, text: e.target.value.split("\n").map(t => t.trim()).filter(Boolean) } : x) })}
              style={{ ...selStyle, textAlign: "left", fontSize: 10.5, lineHeight: 1.7, color: "var(--ink-text)", resize: "vertical" }} />
          </div>
        ))}
        <Note tone="info">这两段是玩家在「人物关系」页手动领取时读到的固定剧情，本作原有角色全是手写的。AI 给的是草稿，值得你自己润一遍。</Note>
      </Section>

      {/* 8 NSFW 段 */}
      {n.nsfwEntries?.length ? (
        <Section title="成人向段落">
          <Note tone="warn">
            这张卡里有 {n.nsfwEntries.length} 条成人向条目（原卡是无条件常驻的）。
            导入后会挂在本作的 ■ 模式开关下，关着就一个字不发。
          </Note>
          <div style={{ marginTop: 6 }}>
            <Pills accent={accent} value={n.nsfwOptIn ? "in" : "out"}
              onChange={v => onPatch({ nsfwOptIn: v === "in" })}
              options={[{ value: "out", label: "不导入这些段落" }, { value: "in", label: "导入，挂开关下" }]} />
          </div>
        </Section>
      ) : null}

      {/* 9-11 内外功 · 七维 · 气血 */}
      <Section title={<>内功与外功<Src source={n.source} why={n.gongfuWhy} /></>}>
        <StatRow label="内功" value={neigong} max={100} step={1} width={30}
          onChange={v => onPatch({ neigong: v })} />
        <StatRow label="外功" value={waigong} max={100} step={1} width={30}
          onChange={v => onPatch({ waigong: v })} />
        <div style={{ fontSize: 10, color: "var(--ink-text-dim)", marginTop: 4, lineHeight: 1.7 }}>
          {TIERS[cap]?.label}档的基准是 {TIER_NEIGONG[cap]}。
          气血由内功与体魄算出：<span style={{ color: "var(--ink-warn)" }}>{maxHp}</span>
          {atk != null ? <>；出手威力由外功算出：<span style={{ color: "var(--ink-warn)" }}>{atk}</span></> : null}
          。这两项跟着上面走，不单独设。
        </div>
      </Section>

      <Section title={<>七维天赋<Src source={n.source} why={n.specialWhy} /></>}>
        <SevenDim special={n.special} onChange={s => onPatch({ special: s })} />
      </Section>

      {/* 12 招式 */}
      <Section title="招式（选路数与起名，效果由原型×品阶算出）">
        <MoveEditor moves={n.moves} levelCap={cap} source={n.source} why={n.movesWhy}
          onChange={m => onPatch({ moves: m })} />
      </Section>

      {/* 13 随身物 */}
      <Section title="随身物（偷窃与切磋掉落）">
        <CarryPicker apiCfg={apiCfg} carry={n.carry || []} levelCap={cap} onChange={c => onPatch({ carry: c })} />
      </Section>

      {/* 14 立绘 */}
      <Section title="立绘">
        <PortraitPicker value={n.portrait || ""} cardImage={cardImage} npcName={n.name}
          onChange={v => onPatch({ portrait: v })} />
      </Section>

      {/* 15 落脚 */}
      <Section title="落脚 · 他会出现在哪">
        <Placement value={n.placement} accent={accent} npc={n} apiCfg={apiCfg}
          currentDistrict={currentDistrict}
          why={n.placementWhy} rejected={n.placementRejected}
          onChange={pl => onPatch({ placement: pl, placementWhy: "", placementRejected: false })}
          onPlan={(pl, why, rejected) => onPatch({ placement: pl, placementWhy: why, placementRejected: rejected })} />
      </Section>

      {/* 16 已丢弃的 */}
      {dropped?.length ? (
        <Section title="卡里没被导入的东西" dim>
          {dropped.map((d, i) => (
            <div key={i} style={{ fontSize: 10.5, color: "#7a6a60", lineHeight: 1.8 }}>
              <Src source="drop" /> {d}
            </div>
          ))}
        </Section>
      ) : null}

      {n.mergedFrom?.length > 1 && (
        <Note tone="info">这个人是由 {n.mergedFrom.length} 段合成的：{n.mergedFrom.join(" ＋ ")}</Note>
      )}
    </>
  );
}
