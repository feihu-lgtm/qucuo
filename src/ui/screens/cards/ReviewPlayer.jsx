// 入册审改 · 作为玩家自己
// ============================================================================
// 字段顺序照「导入映射表 · 作为玩家」来，一项不落：
//   名字 / 性别 / 体貌公开层七项 / 体貌私密层五项 / 性格（丢） / 出身背景 /
//   说话风格示范 / 开场白 / 世界观地理规则 / 七维 / 内外功 / 气血
//
// 两条规矩写在这里：
//   · 私密层五项支持 AI 抽取（扫描阶段三默认开启），玩家在下方确认过风险后生效。
//     只抽原文明确写到的项，没写的一律留空手填。卡池里动漫角色占绝大多数，自动
//     抽取可能为未成年角色生成身体描写——确认条就是为这一条设的。
//   · 卡的 personality 一律丢弃。玩家的性格由每轮输入实时表达，写死会跟实际
//     操作打架——你打「我冷笑一声」，卡里写着「温和有礼」，两句话互相拆台。

import React, { useState } from "react";
import {
  BODY_PUBLIC, BODY_PRIVATE, TIERS, StatRow, SevenDim, Src, TextField,
  Section, Note, Pills, selStyle,
} from "./widgets.jsx";
import { TIER_NEIGONG } from "../../../domain/rules/cards/scanPrompts.js";
import { hpFromNeigong } from "../../../domain/rules/npc/npcGeneration.js";
import CarryPicker from "./CarryPicker.jsx";
import SkillEditor from "./SkillEditor.jsx";
import usePlayerAiScans from "./playerAiScans.js";
import { tierFromNeigong } from "../../../domain/rules/cards/skillPlan.js";

export default function ReviewPlayer({
  player, onPatch, accent, apiCfg,
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

  // 武学/装备的品阶上限跟着内功走（白档基准内功 5）。AI 现编的武学、AI 配的装备
  // 都不许超过这个档，免得白袍开局就红档神功。
  const tier = tierFromNeigong(neigong);
  const {
    aiMsg, bodyDesc, setBodyDesc,
    bodyBusy, skillBusy, equipBusy,
    aiScanBody, aiScanSkills, aiScanEquip,
  } = usePlayerAiScans({ p, tier, bp, priv, onPatch, apiCfg, cardMesExample, cardPersonality });

  // 私密层 AI 抽取的风险确认：功能默认开启，玩家点过「我已了解」后记住，不再打扰。
  // 存 localStorage 而不是进档案——这是玩家对导入器的知情声明，不是角色数据。
  const INTIMATE_ACK_KEY = "intimateScanAck";
  const [privAcked, setPrivAcked] = useState(() => {
    try { return localStorage.getItem(INTIMATE_ACK_KEY) === "1"; } catch { return false; }
  });
  const ackIntimate = () => {
    try { localStorage.setItem(INTIMATE_ACK_KEY, "1"); } catch { /* 存不上也不影响本会话 */ }
    setPrivAcked(true);
  };

  return (
    <>
      {/* 1 名字 · 2 性别 */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <TextField label={<>名讳<Src source={p.source} why={p.nameWhy} /></>}
            value={p.name} max={12} onChange={v => onPatch({ name: v })} />
        </div>
        <div style={{ width: 200 }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-muted)", marginBottom: 3, textAlign: "center" }}>
            性别<Src source="manual" />
          </div>
          <Pills accent={accent} value={p.gender || "男"} onChange={v => onPatch({ gender: v })}
            options={["男", "女", "其他"]} />
        </div>
      </div>

      {/* 3 体貌公开层 */}
      <Section title={<>体貌 · 公开层<span style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-muted)", marginLeft: 6 }}>{publicFilled}/7 项</span></>}>
        {BODY_PUBLIC.map(([k, label]) => (
          <TextField key={k} label={label} max={40} placeholder="留空由你自己填"
            value={bp[k]} onChange={v => setBody(k, v)} />
        ))}
        <Note tone="info">这七项在近距离互动的回合会注入给说书人，赶路那种回合自动灭灯，不占篇幅。</Note>
      </Section>

      {/* 4 体貌私密层 */}
      <Section title={<>体貌 · 私密层<span style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-muted)", marginLeft: 6 }}>{privFilled}/5 项</span></>}>
        {!privAcked ? (
          <Note tone="warn">
            AI 现在会自动从卡里抽取这五项（疤痕印记／体味／身体细节／敏感处／习惯癖好）。
            自动抽取可能为未成年角色生成身体描写。
            <span onClick={ackIntimate}
              style={{ cursor: "pointer", color: "var(--service-item-name)", fontWeight: 700, textDecoration: "underline", marginLeft: 6 }}>
              我已了解风险
            </span>
          </Note>
        ) : (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-muted)", marginTop: 0, lineHeight: 1.7 }}>
            ✓ 已确认风险，AI 扫描会自动抽取私密层。只抽原文明确写到的项，没写的留空由你填。
          </div>
        )}
        {BODY_PRIVATE.map(([k, label]) => (
          <TextField key={k} label={label} max={40}
            placeholder={privAcked ? "AI 抽到的会自动填，留空自己写" : "留空由你自己填"}
            value={priv[k]} onChange={v => setPriv(k, v)} />
        ))}
        <Note tone="info">
          填了也只在 ■ 模式开启时注入。卡池里动漫角色占绝大多数，若这张卡的描写涉及未成年
          角色，请主动清空下方 AI 抽到的相关项。
        </Note>

        {/* 4b 粘贴描写 → AI 拆成体貌字段补全 */}
        <div style={{ marginTop: 10, padding: "8px 9px", borderRadius: 0, background: "rgba(0,0,0,.22)", border: "1px solid var(--bg-card)" }}>
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--loot-foot)", marginBottom: 5, lineHeight: 1.6 }}>
            ✨ 粘贴一段卡里的外貌／身体描写，AI 会拆成体貌字段（公开层＋私密层）补全上面两栏。
            只是合并，不会覆盖你已填的内容。
          </div>
          <textarea
            value={bodyDesc}
            onChange={e => setBodyDesc(e.target.value.slice(0, 800))}
            placeholder={"例：眉压得低，笑起来右边有个浅酒窝；左肋一道旧刀疤，是在锦官城挨的；凑近了闻得到松脂混一点铁锈味……"}
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,.35)",
              border: "1px solid var(--border-deep)", borderRadius: 0, padding: "5px 8px",
              color: "var(--paper)", fontSize: 11.5, outline: "none", resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
            <span onClick={bodyBusy ? undefined : aiScanBody}
              title="让 AI 把这段描写拆成体貌字段"
              style={{
                cursor: bodyBusy ? "wait" : "pointer", userSelect: "none",
                fontSize: 11.5, padding: "5px 12px", borderRadius: 0, whiteSpace: "nowrap",
                display: "inline-flex", alignItems: "center", gap: 5,
                color: bodyBusy ? "var(--quest-success-text)" : "var(--ci-pick)", textShadow: "0 1px 2px rgba(0,0,0,.85)",
                border: `1px solid ${bodyBusy ? "var(--music-idle-icon)" : "var(--ink-good)"}`,
                background: bodyBusy ? "rgba(0,0,0,.3)" : "linear-gradient(180deg,rgba(74,120,64,.5),rgba(0,0,0,.45))",
              }}>✨ {bodyBusy ? "拆解中…" : "AI 拆解补全"}</span>
            <span style={{ flex: 1, fontSize: 9.5, color: "var(--muted)" }}>
              私密项原文没写到的 AI 不会编。
            </span>
          </div>
        </div>
      </Section>

      {/* 5 性格（丢弃） */}
      <Section title={<>性格<Src source="drop" /></>} dim>
        {cardPersonality ? (
          <div style={{ fontSize: "var(--fs-xs)", lineHeight: 1.7, color: "var(--bug-dim-dark)", maxHeight: 76, overflowY: "auto",
          padding: "6px 8px", background: "rgba(0,0,0,.28)", border: "1px solid var(--bg-card)", borderRadius: 0, }}>{cardPersonality}</div>
        ) : (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-text-dim)" }}>这张卡没写 personality。</div>
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
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-text-dim)" }}>这张卡没写 mes_example，此项留空。</div>
        )}
      </Section>

      {/* 8 开场白 */}
      {opening && (
        <Section title={<>开场白{opening.source === "ai" ? <Src source="ai" why="已归化人称与文体" /> : <Src source="fallback" />}</>}>
          <TextField label={null} rows={6} value={opening.rewritten}
            onChange={v => onPatchOpening({ ...opening, rewritten: v })} />
          {opening.source === "ai" && opening.original !== opening.rewritten && (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 10.5, color: "var(--ink-text-dim)" }}>看原文对照</summary>
              <div style={{ fontSize: "var(--fs-xs)", lineHeight: 1.7, color: "var(--ink-text-dim)", whiteSpace: "pre-wrap", marginTop: 6 }}>
                {opening.original}
              </div>
            </details>
          )}
        </Section>
      )}

      {/* 9 世界观、地理、规则 */}
      <Section title={<>世界观 · 地理 · 规矩<span style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-muted)", marginLeft: 6 }}>{(worldCandidates || []).filter(w => w.on !== false).length}/{(worldCandidates || []).length} 条</span></>}>
        {!worldCandidates?.length ? (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--ink-text-dim)" }}>这张卡里没有地理／势力／规矩类条目。</div>
        ) : (
          <>
            {worldCandidates.map((w, i) => (
              <div key={i} onClick={() => onPatchWorld(i, { on: w.on === false })}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "5px 8px", marginBottom: 3,
                  cursor: "pointer", borderRadius: 0,
                  border: `1px solid ${w.on === false ? "var(--bg-card)" : "var(--service-card-edge)"}`,
                  background: w.on === false ? "transparent" : "rgba(212,168,83,.08)",
                }}>
                <span style={{ color: w.on === false ? "var(--gamble-button-edge)" : accent, fontSize: "var(--fs-xs)" }}>
                  {w.on === false ? "○" : "◉"}
                </span>
                <span style={{ color: "var(--ink-text)", fontSize: 11, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {w.label}
                </span>
                <span style={{ color: "var(--ink-text-dim)", fontSize: "var(--fs-2xs)" }}>{w.kind} · {(w.content || "").length}字</span>
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
        <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-text-dim)", marginTop: 4, lineHeight: 1.7 }}>
          开局默认都是 5（白档基准 {TIER_NEIGONG[0]}），往后靠花潜能修炼。
          气血由内功与体魄算出：<span style={{ color: "var(--ink-warn)" }}>{maxHp}</span>，不单独设。
        </div>
        <Note tone="info">调高这两项等于开局就带一身功夫。想从零开始就别动它。</Note>
      </Section>

      {/* 13 初始武学（AI 现编）*/}
      <Section title={<>初始武学<Src source="ai" why="AI 照卡里招式描写现编" /><span style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-muted)", marginLeft: 6 }}>{(p.skills || []).length} 门</span></>}>
        <SkillEditor skills={p.skills} tierCap={tier} accent={accent}
          aiBusy={skillBusy} onAiScan={aiScanSkills}
          onChange={sk => onPatch({ skills: sk })} />
        <Note tone="info">
          切磋按「攻击/防御/状态」各取一门 active 的武学出招，缺某路自动用白档制式招补上。
          品阶越高招式越强，往后可在游戏里花潜能修炼。
        </Note>
      </Section>

      {/* 14 初始装备（AI 配，点物件名看词条）*/}
      <Section title={<>初始装备<Src source="ai" why="AI 按身份与品阶配" /><span style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-muted)", marginLeft: 6 }}>{(p.carry || []).length} 件</span></>}>
        <CarryPicker apiCfg={apiCfg} carry={p.carry || []} levelCap={tier}
          onChange={c => onPatch({ carry: c })} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <span style={{ flex: 1, fontSize: 10, color: "var(--ink-text-dim)", lineHeight: 1.6 }}>
            兵器/护具/饰物导入后各自动装备一件，其余进背包。点上面的物件名可展开看它的词条（攻击力/特效/加成）。
          </span>
          <span onClick={equipBusy ? undefined : aiScanEquip}
            title="让 AI 按主角身份与品阶配 2-4 件随身物"
            style={{
              cursor: equipBusy ? "wait" : "pointer", userSelect: "none",
              fontSize: 11.5, padding: "5px 12px", borderRadius: 0, whiteSpace: "nowrap",
              display: "inline-flex", alignItems: "center", gap: 5,
              color: equipBusy ? "var(--ink-sage)" : "var(--ci-pick)", textShadow: "0 1px 2px rgba(0,0,0,.85)",
              border: `1px solid ${equipBusy ? "var(--music-idle-icon)" : "var(--inject-note)"}`,
              background: equipBusy ? "rgba(0,0,0,.3)" : "linear-gradient(180deg,rgba(60,130,120,.5),rgba(0,0,0,.45))",
            }}>✨ {equipBusy ? "配装中…" : "AI 配装备"}</span>
        </div>
      </Section>

      {aiMsg && <Note tone="info">{aiMsg}</Note>}
    </>
  );
}
