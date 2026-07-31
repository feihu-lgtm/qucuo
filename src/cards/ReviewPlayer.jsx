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

import React, { useState } from "react";
import {
  BODY_PUBLIC, BODY_PRIVATE, TIERS, StatRow, SevenDim, Src, TextField,
  Section, Note, Pills, selStyle,
} from "./ReviewParts.jsx";
import { TIER_NEIGONG, parseJsonLoose } from "./scanPrompts.js";
import { hpFromNeigong } from "../npcGeneration.js";
import { CarryPicker } from "./ReviewNpc.jsx";
import { callModel } from "../apiConfig.js";
import { acquire } from "./rateLimiter.js";
import { buildSkillPlan, sanitizeSkillPlan, tierFromNeigong, SKILL_PLAN_MAX_TOKENS } from "./skillPlan.js";
import { buildCarryPlan, sanitizeCarryPlan, CARRY_PLAN_MAX_TOKENS } from "./carryPlan.js";

// 主角武学编辑器：一门武学 = 名字 + 路数（攻击/防御/状态）+ 品阶 + active + 一句描述。
// 【为什么主角用「武学」而不是 NPC 那套 5 槽招式】主角的战斗招式由武学(skills)派生
// （见 npcGeneration.deriveMovesetFromSkills）：切磋按攻击/防御/状态各取一门 active 的
// 武学出招，缺某路自动用白档制式招补上。武学能升级、能花潜能修炼，是主角专属的成长线。
function SkillEditor({ skills, onChange, tierCap, accent, aiBusy, onAiScan }) {
  const list = Array.isArray(skills) ? skills : [];
  const setOne = (i, patch) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const del = (i) => onChange(list.filter((_, j) => j !== i));
  const add = () => onChange([...list, {
    name: "", quality: TIERS[tierCap]?.label || "白", level: 1, exp: 0, maxExp: 100,
    stage: "入门", active: true, moveType: "攻击",
  }]);
  return (
    <div>
      {!list.length && (
        <div style={{ fontSize: 10.5, color: "#6a6250", marginBottom: 8, lineHeight: 1.7 }}>
          还没有武学。点「✨ AI 现编武学」让它照卡里的招式描写生成，或手动加一门。
        </div>
      )}
      {list.map((s, i) => (
        <div key={i} style={{ marginBottom: 7, padding: "7px 9px", borderRadius: 3, background: "rgba(0,0,0,.22)", border: "1px solid #2a2419" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <input value={s.name || ""} placeholder="武学名"
              onChange={e => setOne(i, { name: e.target.value.slice(0, 10) })}
              style={{ ...selStyle, flex: 1, textAlign: "center" }} />
            <select value={s.moveType || "攻击"} onChange={e => setOne(i, { moveType: e.target.value })}
              style={{ ...selStyle, width: 60 }}>
              {["攻击", "防御", "状态"].map(t => <option key={t} value={t} style={{ background: "#1a1206" }}>{t}</option>)}
            </select>
            <select value={s.quality || "白"} onChange={e => setOne(i, { quality: e.target.value })}
              style={{ ...selStyle, width: 62 }}>
              {TIERS.map(t => <option key={t.label} value={t.label} style={{ background: "#1a1206", color: t.color }}>{t.label}档</option>)}
            </select>
            <span onClick={() => setOne(i, { active: !s.active })}
              title={s.active ? "这门当前会出手（同路数只第一门生效）" : "点亮才会用它出招"}
              style={{ cursor: "pointer", fontSize: 10, color: s.active ? accent : "#5a5448", flexShrink: 0, whiteSpace: "nowrap" }}>
              {s.active ? "◉ 用" : "○ 备"}
            </span>
            <span onClick={() => del(i)} title="删掉这门"
              style={{ cursor: "pointer", color: "#c08878", fontSize: 11, flexShrink: 0 }}>✕</span>
          </div>
          <input value={s.desc || ""} placeholder="一句话写这门功夫使出来什么样（注入给说书人）"
            onChange={e => setOne(i, { desc: e.target.value.slice(0, 30) })}
            style={{ ...selStyle, textAlign: "left", fontSize: 10.5, color: "#c8bfa0" }} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
        <span onClick={add} style={{ cursor: "pointer", fontSize: 10.5, color: "#8a8270" }}>＋ 加一门</span>
        <span style={{ flex: 1 }} />
        <span onClick={aiBusy ? undefined : onAiScan}
          title="让 AI 照卡里主角的招式/战斗描写现编武学"
          style={{
            cursor: aiBusy ? "wait" : "pointer", userSelect: "none",
            fontSize: 11.5, padding: "5px 12px", borderRadius: 4, whiteSpace: "nowrap",
            display: "inline-flex", alignItems: "center", gap: 5,
            color: aiBusy ? "#7a8a78" : "#cdeebf", textShadow: "0 1px 2px rgba(0,0,0,.85)",
            border: `1px solid ${aiBusy ? "#3a4a38" : "#5f8256"}`,
            background: aiBusy ? "rgba(0,0,0,.3)" : "linear-gradient(180deg,rgba(74,120,64,.5),rgba(0,0,0,.45))",
          }}>✨ {aiBusy ? "现编中…" : "AI 现编武学"}</span>
      </div>
    </div>
  );
}

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
  const [skillBusy, setSkillBusy] = useState(false);
  const [equipBusy, setEquipBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");

  // AI 现编武学：读主角人设 + 卡的性格/招式线索，产 1-3 门武学（覆盖现有的）。
  const aiScanSkills = async () => {
    if (skillBusy || !apiCfg) return;
    setSkillBusy(true); setAiMsg("正在现编武学…");
    try {
      await acquire(ms => setAiMsg(`排队 ${Math.ceil(ms / 1000)}s…`));
      const { system, user } = buildSkillPlan(p, { tier, moveHints: cardMesExample || cardPersonality });
      const res = await callModel(apiCfg, system, [{ role: "user", content: user }],
        { maxTokens: SKILL_PLAN_MAX_TOKENS, temperature: 0.7 });
      const skills = sanitizeSkillPlan(parseJsonLoose(res.text || ""), { tierCap: tier });
      if (skills.length) { onPatch({ skills }); setAiMsg(`现编了 ${skills.length} 门武学，可自己改`); }
      else setAiMsg("AI 没给出认得出的武学，再点一次试试");
    } catch (e) {
      setAiMsg(`没成：${String(e?.message || e).slice(0, 60)}`);
    } finally { setSkillBusy(false); }
  };

  // AI 配装备：借 carryPlan（跟入册里「AI 一键配装备」同一套），把主角当一个人送去
  // 配 2-4 件随身物，覆盖现有 carry。品阶不超过 tier。
  const aiScanEquip = async () => {
    if (equipBusy || !apiCfg) return;
    setEquipBusy(true); setAiMsg("正在配装备…");
    try {
      await acquire(ms => setAiMsg(`排队 ${Math.ceil(ms / 1000)}s…`));
      const one = [{ name: p.name || "主角", levelCap: tier, brief: "游历江湖的主角", entry: p.persona || "" }];
      const { system, user } = buildCarryPlan(one);
      const res = await callModel(apiCfg, system, [{ role: "user", content: user }],
        { maxTokens: CARRY_PLAN_MAX_TOKENS.batch, temperature: 0.7 });
      const plans = sanitizeCarryPlan(parseJsonLoose(res.text || ""), one);
      const items = plans[0]?.items || [];
      if (items.length) { onPatch({ carry: items }); setAiMsg(`配了 ${items.length} 件装备，点物件名看词条`); }
      else setAiMsg("AI 没配出装备，再点一次试试");
    } catch (e) {
      setAiMsg(`没成：${String(e?.message || e).slice(0, 60)}`);
    } finally { setEquipBusy(false); }
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

      {/* 13 初始武学（AI 现编）*/}
      <Section title={<>初始武学<Src source="ai" why="AI 照卡里招式描写现编" /><span style={{ fontSize: 10, color: "#8a8270", marginLeft: 6 }}>{(p.skills || []).length} 门</span></>}>
        <SkillEditor skills={p.skills} tierCap={tier} accent={accent}
          aiBusy={skillBusy} onAiScan={aiScanSkills}
          onChange={sk => onPatch({ skills: sk })} />
        <Note tone="info">
          切磋按「攻击/防御/状态」各取一门 active 的武学出招，缺某路自动用白档制式招补上。
          品阶越高招式越强，往后可在游戏里花潜能修炼。
        </Note>
      </Section>

      {/* 14 初始装备（AI 配，点物件名看词条）*/}
      <Section title={<>初始装备<Src source="ai" why="AI 按身份与品阶配" /><span style={{ fontSize: 10, color: "#8a8270", marginLeft: 6 }}>{(p.carry || []).length} 件</span></>}>
        <CarryPicker apiCfg={apiCfg} carry={p.carry || []} levelCap={tier}
          onChange={c => onPatch({ carry: c })} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <span style={{ flex: 1, fontSize: 10, color: "#6a6250", lineHeight: 1.6 }}>
            兵器/护具/饰物导入后各自动装备一件，其余进背包。点上面的物件名可展开看它的词条（攻击力/特效/加成）。
          </span>
          <span onClick={equipBusy ? undefined : aiScanEquip}
            title="让 AI 按主角身份与品阶配 2-4 件随身物"
            style={{
              cursor: equipBusy ? "wait" : "pointer", userSelect: "none",
              fontSize: 11.5, padding: "5px 12px", borderRadius: 4, whiteSpace: "nowrap",
              display: "inline-flex", alignItems: "center", gap: 5,
              color: equipBusy ? "#6a807c" : "#b4ecdc", textShadow: "0 1px 2px rgba(0,0,0,.85)",
              border: `1px solid ${equipBusy ? "#3a4a48" : "#4f807a"}`,
              background: equipBusy ? "rgba(0,0,0,.3)" : "linear-gradient(180deg,rgba(60,130,120,.5),rgba(0,0,0,.45))",
            }}>✨ {equipBusy ? "配装中…" : "AI 配装备"}</span>
        </div>
      </Section>

      {aiMsg && <Note tone="info">{aiMsg}</Note>}
    </>
  );
}
