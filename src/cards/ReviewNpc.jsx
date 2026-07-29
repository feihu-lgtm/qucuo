// 入册审改 · 作为 NPC
// ============================================================================
// 字段顺序照「导入映射表 · 作为 NPC」来，一项不落：
//   角色名 / 别名 / 一句话身份 / 人设正文 / 外貌锚点 / 好感初值 / 好感里程碑 /
//   NSFW 段 / 品阶 / 内外功 / 七维 / 气血 / 随身物 / 招式 / 立绘 / 落脚 /
//   已丢弃的（状态栏格式、前端脚本）
//
// 标 ⚠ 的四项（品阶、随身物、招式、内外功七维）卡里根本没有，是 AI 抽的草案或
// 默认值，所以每项都带来源标记与判断依据——没有依据的话玩家只能盲信。

import React, { useState, useMemo } from "react";
import {
  S, PORTRAIT, TIERS, SEVEN, JadeTier, StatRow, SevenDim, Src, TextField,
  Section, Note, Pills, Step, selStyle,
} from "./ReviewParts.jsx";
import { normalizePlacement } from "./importedRegistry.js";
import { MOVE_ARCHETYPE_IDS, MOVE_SLOTS, SLOT_DEFAULT_ARCHETYPE, TIER_NEIGONG, parseJsonLoose } from "./scanPrompts.js";
import { buildPlacementPlan, sanitizePlacementPlan, PLAN_MAX_TOKENS } from "./placementPlan.js";
import { acquire } from "./rateLimiter.js";
import { MOVE_ARCHETYPES, resolveArchetype } from "../combat/moveArchetypes.js";
import { hpFromNeigong, atkFromWaigong } from "../npcGeneration.js";
import { CATALOG } from "../items/catalog.js";
import { callModel } from "../apiConfig.js";
import { QUCUO_MAP } from "../qucuoMap.js";
import { hasInnerMap, getPublicInnerRoomNames } from "../innerMap.js";

// 心灵之海是好感解锁的意识空间、第三新东京市是终章一次性据点，都不该当日常落脚点
const DISTRICTS = Object.keys(QUCUO_MAP).filter(d => d !== "心灵之海" && d !== "第三新东京市");

// 物品描述的输出上限。跟 PLAN_MAX_TOKENS 同一个理由：原来写死 400，在带思考的
// 模型上会被思考 token 吃穿。这一处的症状比落脚规划更隐蔽——它要的是纯文本，
// 截断不会报错，只是玩家看到的描述莫名缺半截，还以为是模型没写好。
const ITEM_DESC_MAX_TOKENS = 2000;

const PLACEMENT_LABEL = { mention: "不落地", resident: "驻场", wander: "游走" };
const PLACEMENT_HINT = {
  mention: "他的人设只在被提到时注入，不会主动出现在任何据点。适合远方的人、传闻里的人。",
  resident: "进了这个据点必定遇见他，不受时辰与运气影响。跟村长、掌柜这类人同一个待遇。",
  wander: "按权重每天随机出现在选中的据点，且只在设定的时辰里露面。跟行商、镖师同一个待遇。",
};

// 招式效果标志位 → 人话。这些键来自 combat/moveArchetypes.js 的 tiers，
// 直接把英文键甩给玩家看等于没显示，所以逐个给个说法。
const EFFECT_LABEL = {
  energyCost: "内力消耗",
  baseDamageMultiplier: "威力倍率",
  onCounterSuccessDamageRatio: "反打比例",
  onCounterSuccessEnergyGain: "反制回气",
  onCounterSuccessPreemptive: "反制抢先结算",
  onCounterFailEnergyPenalty: "失手扣气",
  onCounterFailDefenseNullified: "失手防御失效",
  counterStacksGrowth: "连挡叠势",
  dispelSelf: "运功自解",
  doubleVsStatus: "克中状态翻倍",
  ignoreDefense: "无视防御",
  afterStatusBonus: "趁中招追击",
  detonateMark: "引爆内伤",
  forceFirst: "强制先手",
  nullifyStatusOnHit: "命中清状态",
  energyRestore: "回气量",
  nextAttackBonus: "下击加成",
  confuseChance: "迷惑概率",
  energyDiffDamage: "气差伤害",
  freezeEnergyRecovery: "冻结对手回气",
  doubleReflectDamage: "双倍反伤",
  hpRestore: "回血比例",
  sealEnergyRecovery: "封住回气",
  type: "招式类型",
};

function fmtEffectValue(v) {
  if (v === true) return "有";
  if (v === false) return "无";
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    return Object.entries(v).map(([k, x]) => `${EFFECT_LABEL[k] || k} ${x}`).join("、");
  }
  return String(v);
}

// ── 招式编辑器 ────────────────────────────────────────────────────────────────

/**
 * 【为什么是「选原型 + 起名」而不是「勾十几个标志位」】
 * 本作的招式效果由 原型 × 品阶 自动解出（见 combat/moveArchetypes.js）：同一个
 * 「防守反击」，白档只是挡一下，红档是听桥——近乎全免＋满反打＋抢先结算。
 * 所以玩家该决定的是"这人走哪条路数"，不是逐个数值。改品阶，招式会跟着变强变弱。
 * 底下那块「本档实际效果」把解出来的数值摊开给你看，不用猜。
 */
function MoveEditor({ moves, levelCap, onChange, why, source }) {
  const [open, setOpen] = useState(null);
  const slots = useMemo(() => {
    const base = [...MOVE_SLOTS];
    if (moves && moves["疗伤"]) base.push("疗伤");
    return base;
  }, [moves]);

  const setSlot = (slot, patch) => onChange({ ...moves, [slot]: { ...(moves?.[slot] || {}), ...patch } });

  return (
    <div>
      {slots.map(slot => {
        const m = moves?.[slot] || {};
        const arch = m.archetype || SLOT_DEFAULT_ARCHETYPE[slot];
        const resolved = resolveArchetype(arch, levelCap) || {};
        const isOpen = open === slot;
        const type = MOVE_ARCHETYPES[arch]?.type || "—";
        return (
          <div key={slot} style={{ marginBottom: 7, padding: "7px 9px", borderRadius: 3, background: "rgba(0,0,0,.22)", border: "1px solid #2a2419" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <span style={{ width: 30, fontSize: 11, color: "#d4a853", flexShrink: 0 }}>{slot}</span>
              <input value={m.name || ""} placeholder={`${arch}（未起名）`}
                onChange={e => setSlot(slot, { name: e.target.value.slice(0, 10) })}
                style={{ ...selStyle, flex: 1, textAlign: "center" }} />
              {/* 回气槽固定走「回气」原型，不给选——它是能量枯竭时的保底招 */}
              {slot === "回气" ? (
                <span style={{ width: 86, textAlign: "center", fontSize: 11, color: "#6a6250" }}>回气</span>
              ) : (
                <select value={arch} onChange={e => setSlot(slot, { archetype: e.target.value })}
                  style={{ ...selStyle, width: 86 }}>
                  {MOVE_ARCHETYPE_IDS.map(a => (
                    <option key={a} value={a} style={{ background: "#1a1206" }}>{a}</option>
                  ))}
                </select>
              )}
              <span onClick={() => setOpen(isOpen ? null : slot)}
                title="看这一档解出来的实际效果"
                style={{ cursor: "pointer", fontSize: 10, color: "#8ac8b8", flexShrink: 0 }}>
                {isOpen ? "收起" : "数值"}
              </span>
            </div>
            <input value={m.desc || ""} placeholder="一句话写这招看起来什么样（会注入给说书人）"
              onChange={e => setSlot(slot, { desc: e.target.value.slice(0, 60) })}
              style={{ ...selStyle, textAlign: "left", fontSize: 10.5, color: "#c8bfa0" }} />
            {isOpen && (
              <div style={{ marginTop: 6, padding: "6px 8px", background: "#0a0c10", border: "1px solid #1a2020", borderRadius: 3 }}>
                <div style={{ fontSize: 9.5, color: "#5a6a6a", marginBottom: 4, fontFamily: "ui-monospace,Menlo,Consolas,monospace" }}>
                  {arch} × {TIERS[levelCap]?.label}档 → 类型 {type}
                </div>
                {Object.entries(resolved).filter(([k]) => k !== "type").map(([k, v]) => (
                  <div key={k} style={{ display: "flex", fontSize: 10, color: "#9a9a8a", lineHeight: 1.6 }}>
                    <span style={{ width: 108, color: "#6a7a7a", flexShrink: 0 }}>{EFFECT_LABEL[k] || k}</span>
                    <span style={{ color: "#8ac8b8" }}>{fmtEffectValue(v)}</span>
                  </div>
                ))}
                <div style={{ fontSize: 9.5, color: "#5a6a6a", marginTop: 5 }}>
                  这些数值由原型和品阶算出，改品阶会整套跟着变，不用手填。
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
        {!moves?.["疗伤"] ? (
          <span onClick={() => setSlot("疗伤", { archetype: "疗伤", name: "", desc: "" })}
            title="第五招，只有会运功回血的人才配"
            style={{ cursor: "pointer", fontSize: 10.5, color: "#8a8270" }}>＋ 加一个疗伤招</span>
        ) : (
          <span onClick={() => { const n = { ...moves }; delete n["疗伤"]; onChange(n); }}
            style={{ cursor: "pointer", fontSize: 10.5, color: "#8a8270" }}>− 去掉疗伤招</span>
        )}
        <span style={{ flex: 1 }} />
        {why ? <span style={{ fontSize: 10, color: "#6a6250", fontStyle: "italic" }}>据「{why}」</span> : null}
        <Src source={source} />
      </div>
    </div>
  );
}

// ── 随身物 ────────────────────────────────────────────────────────────────────

/**
 * 【默认为空是有意的】卡里没有物品信息，留空时运行时会走 rollNpcCarry 的四池
 * 随机抽（按品阶给武器/护甲/饰品/杂物），不至于两手空空。只有你想精确指定
 * 「这人身上一定有那把刀」时才需要在这儿挑。
 */
function CarryPicker({ carry, onChange, levelCap, apiCfg }) {
  const [cat, setCat] = useState("");
  const [qual, setQual] = useState("");
  const [kw, setKw] = useState("");
  const [forging, setForging] = useState(false);   // 是否展开"新造一件"
  const [draft, setDraft] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  const cats = useMemo(() => [...new Set(CATALOG.map(e => e.category).filter(Boolean))], []);
  // 【为什么不再 slice(0,60)】百物录现在 406 件（兵器 101 / 护具 59 / 饰物 82 /
  // 杂物 164），原来只渲染前 60 件且不做任何提示——玩家不搜名字就永远翻不到后面
  // 那 346 件，看起来像是"库里只有这些"。406 个条目对 React 不算负担，容器给
  // 滚动条即可，真正需要的是筛得动：类别、品阶、关键词三个维度。
  // 关键词连 desc 一起搜，找"止血的"比记得住药名实用。
  const list = useMemo(() => {
    const k = kw.trim();
    return CATALOG.filter(e =>
      (!cat || e.category === cat)
      && (!qual || e.quality === qual)
      && (!k || e.name.includes(k) || (e.desc || "").includes(k)));
  }, [cat, qual, kw]);

  // carry 的元素有两种：在册物品只存名字字符串，自造物品存完整对象。
  // 所有增删判重都必须过 nameOf，不能直接 includes——否则自造的那件永远判不出
  // "已选"，会被重复加进去。
  const nameOf = (c) => (typeof c === "string" ? c : (c?.name || ""));
  const has = (name) => carry.some(c => nameOf(c) === name);
  const add = (item) => { if (!has(nameOf(item))) onChange([...carry, item]); };
  const del = (name) => onChange(carry.filter(c => nameOf(c) !== name));

  const blankDraft = () => ({ name: "", category: cat || "weapon", quality: TIERS[levelCap]?.label || "白", desc: "", sixDim: {} });

  // 让 AI 补描述。只写描述，不碰数值——数值是玩家自己定的，AI 一插手就会
  // 出现"界面上写着加2身法、描述里说这是把重剑"这种自相矛盾。
  const askAiDesc = async () => {
    if (!draft?.name || aiBusy) return;
    setAiBusy(true);
    try {
      const six = Object.entries(draft.sixDim || {}).filter(([, v]) => v).map(([k, v]) => `${k}+${v}`).join("、");
      const sys = `你在为一个中文武侠文字游戏写物品描述。用白话古文，两到三句，六十字以内。
只写这件东西看上去什么样、摸上去什么手感、来历或用处的一点线索。
不要复述它的属性数值，不要用"这件装备"这类游戏术语，不要夸大成神兵。
直接输出描述正文，不要引号、不要标题、不要任何说明。`;
      const usr = `名称：${draft.name}
类别：${{ weapon: "兵器", armor: "护具", accessory: "饰物", misc: "杂物" }[draft.category] || draft.category}
品阶：${draft.quality}档${six ? `\n附带：${six}` : ""}`;
      const res = await callModel(apiCfg, sys, [{ role: "user", content: usr }], { maxTokens: ITEM_DESC_MAX_TOKENS, temperature: 0.8 });
      const text = (res.text || "").trim().replace(/^["「『]|["」』]$/g, "");
      if (text) setDraft(d => ({ ...d, desc: text.slice(0, 200) }));
    } catch (e) {
      setDraft(d => ({ ...d, desc: (d.desc || "") + (d.desc ? "" : `（AI 没写出来：${e.message.slice(0, 30)}）`) }));
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 7, minHeight: 22 }}>
        {!carry.length && (
          <span style={{ fontSize: 10.5, color: "#6a6250" }}>
            未指定 · 运行时按 {TIERS[levelCap]?.label}档 从四池随机抽
          </span>
        )}
        {carry.map((c, i) => {
          const nm = nameOf(c);
          const custom = typeof c !== "string";
          return (
            <span key={nm + i} onClick={() => del(nm)} title={custom ? `自造：${c.desc || "无描述"}` : "点击移除"}
              style={{
                cursor: "pointer", fontSize: 10.5, padding: "3px 8px", borderRadius: 3,
                border: `1px solid ${custom ? "#6a8a70" : "#4a4028"}`,
                background: custom ? "rgba(120,180,130,.10)" : "rgba(212,168,83,.10)", color: "#e8dcc0",
              }}>{custom ? "⚒ " : ""}{nm} ✕</span>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...selStyle, width: 96 }}>
          <option value="" style={{ background: "#1a1206" }}>全部类别</option>
          {cats.map(c => <option key={c} value={c} style={{ background: "#1a1206" }}>{c}</option>)}
        </select>
        <select value={qual} onChange={e => setQual(e.target.value)} style={{ ...selStyle, width: 78 }}>
          <option value="" style={{ background: "#1a1206" }}>全部品阶</option>
          {TIERS.map(t => (
            <option key={t.label} value={t.label} style={{ background: "#1a1206", color: t.color }}>{t.label}档</option>
          ))}
        </select>
        <input value={kw} onChange={e => setKw(e.target.value)} placeholder="搜名字或描述"
          style={{ ...selStyle, flex: 1 }} />
        <span onClick={() => { setForging(f => !f); if (!draft) setDraft(blankDraft()); }}
          title="造一件百物录里没有的东西"
          style={{
            cursor: "pointer", fontSize: 10.5, padding: "4px 10px", borderRadius: 3, whiteSpace: "nowrap",
            border: `1px solid ${forging ? "#8ab070" : "#3a3428"}`,
            color: forging ? "#8ab070" : "#8a8270",
          }}>⚒ 新造一件</span>
      </div>

      {forging && draft && (
        <div style={{ marginBottom: 7, padding: "8px 10px", borderRadius: 3, border: "1px solid #3a4a38", background: "rgba(120,180,130,.05)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input value={draft.name} placeholder="物件名"
              onChange={e => setDraft(d => ({ ...d, name: e.target.value.slice(0, 20) }))}
              style={{ ...selStyle, flex: 1, textAlign: "center" }} />
            <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
              style={{ ...selStyle, width: 84 }}>
              {["weapon", "armor", "accessory", "misc"].map(c => (
                <option key={c} value={c} style={{ background: "#1a1206" }}>
                  {{ weapon: "兵器", armor: "护具", accessory: "饰物", misc: "杂物" }[c]}
                </option>
              ))}
            </select>
            <select value={draft.quality} onChange={e => setDraft(d => ({ ...d, quality: e.target.value }))}
              style={{ ...selStyle, width: 72 }}>
              {TIERS.map(t => (
                <option key={t.label} value={t.label} style={{ background: "#1a1206", color: t.color }}>{t.label}档</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 10, color: "#8a8270", marginBottom: 3 }}>
            六维加成 · 点数字改，0 就是不加（百物录里 139 件带这个，多是 +1 到 +2）
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {SEVEN.map(k => {
              const v = draft.sixDim?.[k] || 0;
              return (
                <span key={k} onClick={() => setDraft(d => {
                  const next = { ...(d.sixDim || {}) };
                  const nv = v >= 3 ? 0 : v + 1;
                  if (nv) next[k] = nv; else delete next[k];
                  return { ...d, sixDim: next };
                })}
                  style={{
                    cursor: "pointer", fontSize: 10, padding: "2px 7px", borderRadius: 3,
                    border: `1px solid ${v ? "#8ab070" : "#2a2419"}`,
                    color: v ? "#c8dfc0" : "#5a5448",
                  }}>{k}{v ? ` +${v}` : ""}</span>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: "#8a8270", flex: 1 }}>描述</span>
            {apiCfg && (
              <span onClick={askAiDesc}
                title={draft.name ? "让 AI 照名字与品阶写两三句" : "先起个名"}
                style={{
                  cursor: draft.name && !aiBusy ? "pointer" : "default", fontSize: 10,
                  color: draft.name && !aiBusy ? "#8ac8b8" : "#4a5450",
                }}>{aiBusy ? "写着…" : "✎ 让 AI 写"}</span>
            )}
          </div>
          <textarea rows={3} value={draft.desc}
            placeholder="自己写，或让 AI 写完再改"
            onChange={e => setDraft(d => ({ ...d, desc: e.target.value.slice(0, 200) }))}
            style={{ ...selStyle, width: "100%", textAlign: "left", resize: "vertical", lineHeight: 1.7 }} />

          <div style={{ display: "flex", gap: 6, marginTop: 7, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#6a6250", flex: 1 }}>
              造出来的东西只属于这个人，不进百物录
            </span>
            <span onClick={() => { setDraft(blankDraft()); }}
              style={{ cursor: "pointer", fontSize: 10.5, color: "#6a6250" }}>清空</span>
            <span
              onClick={() => {
                const nm = (draft.name || "").trim();
                if (!nm) return;
                add({ ...draft, name: nm, custom: true });
                setDraft(blankDraft());
                setForging(false);
              }}
              style={{
                cursor: draft.name.trim() ? "pointer" : "default", fontSize: 11,
                padding: "4px 12px", borderRadius: 3, fontWeight: 700,
                color: draft.name.trim() ? "#1a1206" : "#5a5448",
                background: draft.name.trim() ? "linear-gradient(180deg,#a0c890,#5a8a5a)" : "rgba(0,0,0,.3)",
                border: `1px solid ${draft.name.trim() ? "#a0c890" : "#3a3428"}`,
              }}>⚒ 造好，收进他身上</span>
          </div>
        </div>
      )}

      {/* 计数条：让"库里到底有多少、我筛掉了多少"始终可见。原来静默截断到 60 件，
          玩家没法知道自己看的是全部还是一角 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "3px 8px",
        fontSize: 9.5, color: "#6a6250", background: "rgba(0,0,0,.3)",
        border: "1px solid #2a2419", borderBottom: "none", borderRadius: "3px 3px 0 0",
      }}>
        <span>百物录 {CATALOG.length} 件</span>
        {list.length !== CATALOG.length && <span style={{ color: "#a89870" }}>· 当前 {list.length} 件</span>}
        <span style={{ flex: 1 }} />
        {carry.length ? <span style={{ color: "#d4a853" }}>已选 {carry.length}</span> : null}
      </div>

      <div style={{
        maxHeight: "min(38vh, 380px)", overflowY: "auto",
        border: "1px solid #2a2419", borderRadius: "0 0 3px 3px", background: "rgba(0,0,0,.22)",
      }}>
        {!list.length && <div style={{ padding: 8, fontSize: 10.5, color: "#6a6250" }}>没有匹配的物件</div>}
        {list.map(e => {
          const on = has(e.name);
          const tier = TIERS.find(t => t.label === e.quality);
          return (
            <div key={e.name} onClick={() => (on ? del(e.name) : add(e.name))}
              title={e.desc ? e.desc.slice(0, 60) : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 8px",
                cursor: "pointer", fontSize: 10.5,
                background: on ? "rgba(212,168,83,.10)" : "transparent",
                borderBottom: "1px solid #1e1a12",
              }}>
              <span style={{ color: on ? "#d4a853" : "#4a4436", width: 10 }}>{on ? "◉" : "○"}</span>
              <span style={{ color: tier?.color || "#a89870", width: 14 }}>{e.quality || "—"}</span>
              <span style={{ color: "#c8bfa0", flex: 1 }}>{e.name}</span>
              <span style={{ color: "#5a5448", fontSize: 9.5 }}>{e.category}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 立绘 ──────────────────────────────────────────────────────────────────────

// 现成立绘只有这十张（assets/portraits/），都是既有 NPC 的。让入册角色借用一张
// 总比没有好；不选就只有名字，跟大多数路人一样。
const PORTRAITS = [
  "caidan.webp", "gaze.webp", "heyuxie.webp", "huyanxue.webp", "lanjie.webp",
  "liruoyou.webp", "luoqi.webp", "meiduo.webp", "xuannu.webp", "zhuoma.webp",
];

function PortraitPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      <span onClick={() => onChange("")}
        style={{
          width: 46, height: 46, borderRadius: 3, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${!value ? "#d4a853" : "#2a2419"}`,
          background: "rgba(0,0,0,.3)", fontSize: 10, color: !value ? "#d4a853" : "#6a6250",
        }}>不设</span>
      {PORTRAITS.map(f => (
        <img key={f} src={PORTRAIT(f)} alt="" onClick={() => onChange(f)}
          onError={e => { e.currentTarget.style.display = "none"; }}
          style={{
            width: 46, height: 46, objectFit: "cover", borderRadius: 3, cursor: "pointer",
            border: `1px solid ${value === f ? "#d4a853" : "#2a2419"}`,
            filter: value === f ? "none" : "grayscale(.5) brightness(.8)",
          }} />
      ))}
    </div>
  );
}

// ── 落脚 ──────────────────────────────────────────────────────────────────────

function Placement({ value, onChange, accent, npc, apiCfg, why, rejected, onPlan }) {
  const pl = normalizePlacement(value);
  const rooms = pl.district && hasInnerMap(pl.district) ? getPublicInnerRoomNames(pl.district) : [];
  // 手动改过之后 AI 那句依据就过期了——留着会误导（它说「镇上开铁铺」而你已经
  // 改成了不落地）。所以任何手动改动都把依据一并清掉。
  const set = (patch) => onChange({ ...pl, ...patch });
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [err, setErr] = useState("");

  // AI 只定「谁待在哪」，据点名从 DISTRICTS 里挑，回来的东西过一遍
  // sanitizePlacementPlan 白名单过滤。内层房间它不管，玩家自己在下拉里点。
  const askAiPlace = async () => {
    if (busy || !npc?.name) return;
    setBusy(true); setErr(""); setWait(0);
    try {
      await acquire(ms => setWait(Math.ceil(ms / 1000)));
      setWait(0);
      const { system, user } = buildPlacementPlan([npc], DISTRICTS);
      const res = await callModel(apiCfg, system, [{ role: "user", content: user }],
        { maxTokens: PLAN_MAX_TOKENS.single, temperature: 0.6 });
      const plans = sanitizePlacementPlan(parseJsonLoose(res.text || ""), [npc], DISTRICTS);
      if (!plans.length) { setErr("AI 没给出认得出的安排，再点一次试试"); return; }
      onPlan?.(plans[0].placement, plans[0].why, plans[0].rejected);
    } catch (e) {
      // 把模型实际吐出来的开头一并显示。只报 message 的话，「不是合法 JSON」和
      // 「被截断」看起来一样，而两者的补救办法相反（前者改提示词，后者调额度）。
      const raw = e?.raw ? `　模型吐的是：${String(e.raw).replace(/\s+/g, " ").slice(0, 50)}` : "";
      setErr(`${String(e?.message || e).slice(0, 70)}${raw}`);
    } finally {
      setBusy(false); setWait(0);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Pills accent={accent} value={pl.mode} onChange={m => set({ mode: m })}
          options={["mention", "resident", "wander"].map(m => ({ value: m, label: PLACEMENT_LABEL[m] }))} />
        <span style={{ flex: 1 }} />
        <span onClick={askAiPlace} title="让 AI 按人设判断该驻场还是游走，据点只能从本作地图里选"
          style={{
            cursor: busy ? "wait" : "pointer", userSelect: "none",
            fontSize: 11, padding: "4px 11px", borderRadius: 3, whiteSpace: "nowrap",
            display: "inline-flex", alignItems: "center", gap: 5,
            color: busy ? "#6a7a68" : "#9ac088",
            border: `1px solid ${busy ? "#3a4a38" : "#4a6a48"}`,
            background: busy ? "rgba(0,0,0,.3)"
              : "linear-gradient(180deg,rgba(130,180,120,.16),rgba(0,0,0,.32))",
          }}>
          <img src={S("ui/star.webp")} alt="" style={{ width: 11, height: 11, opacity: busy ? .4 : .9 }} />
          {busy ? (wait ? `排队 ${wait}s` : "正在相地…") : "AI 荐位"}
        </span>
      </div>

      {pl.mode === "resident" && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <label style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 10.5, color: "#8a8270", marginBottom: 3 }}>据点</span>
            <select value={pl.district || ""} onChange={e => set({ district: e.target.value || null, innerRoom: null })} style={selStyle}>
              <option value="" style={{ background: "#1a1206" }}>（未选，等同不落地）</option>
              {DISTRICTS.map(d => <option key={d} value={d} style={{ background: "#1a1206" }}>{d}</option>)}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 10.5, color: "#8a8270", marginBottom: 3 }}>
              常在哪间{rooms.length ? "" : "（无内层）"}
            </span>
            <select value={pl.innerRoom || ""} disabled={!rooms.length}
              onChange={e => set({ innerRoom: e.target.value || null })} style={selStyle}>
              <option value="" style={{ background: "#1a1206" }}>不限</option>
              {rooms.map(r => <option key={r} value={r} style={{ background: "#1a1206" }}>{r}</option>)}
            </select>
          </label>
        </div>
      )}
      {pl.mode === "wander" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10.5, color: "#8a8270", marginBottom: 4 }}>出现在哪些据点 · 点一下加二十五，满了归零</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {DISTRICTS.map(d => {
              const w = pl.weights?.[d] || 0;
              return (
                <span key={d} onClick={() => {
                  const next = { ...(pl.weights || {}) };
                  const nw = w >= 100 ? 0 : w + 25;
                  if (nw > 0) next[d] = nw; else delete next[d];
                  set({ weights: next });
                }}
                  style={{
                    cursor: "pointer", fontSize: 10.5, padding: "3px 8px", borderRadius: 3,
                    border: `1px solid ${w > 0 ? accent : "#2a2419"}`,
                    background: w > 0 ? `rgba(212,168,83,${0.06 + w / 500})` : "transparent",
                    color: w > 0 ? "#e8dcc0" : "#6a6250",
                  }}>{d}{w > 0 ? ` ${w}` : ""}</span>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#8a8270" }}>
            <span>时辰</span>
            <input type="number" min={0} max={23} value={pl.timeSlot[0]}
              onChange={e => set({ timeSlot: [Number(e.target.value), pl.timeSlot[1]] })}
              style={{ ...selStyle, width: 52 }} />
            <span>到</span>
            <input type="number" min={0} max={23} value={pl.timeSlot[1]}
              onChange={e => set({ timeSlot: [pl.timeSlot[0], Number(e.target.value)] })}
              style={{ ...selStyle, width: 52 }} />
            <span style={{ fontSize: 10, color: "#6a6250" }}>（0-23 时，跨夜请分两次入册）</span>
          </div>
        </div>
      )}

      {/* AI 的判断依据。撕纸条底，跟随身物那边自造物品的提示同一套视觉 */}
      {why ? (
        <div style={{
          marginTop: 9, padding: "9px 14px",
          backgroundImage: `url('${S("ui/note_torn.webp")}')`,
          backgroundSize: "100% 100%", backgroundRepeat: "no-repeat",
          display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap",
        }}>
          <span style={{
            fontSize: 9, color: "#9ac088", border: "1px solid #4a6a48",
            borderRadius: 2, padding: "0 4px", flexShrink: 0,
          }}>AI 荐位</span>
          <span style={{ fontSize: 10.5, lineHeight: 1.6, color: "#d8c4a0" }}>{why}</span>
          {rejected && (
            <span style={{ fontSize: 10, color: "#d89080" }}>
              · 它给的据点不在本作地图里，已退回不落地，请自己选
            </span>
          )}
        </div>
      ) : null}
      {err ? <Note tone="bad">{err}</Note> : null}

      <Note tone="info">{PLACEMENT_HINT[pl.mode]}</Note>
    </div>
  );
}

// ── 主体 ──────────────────────────────────────────────────────────────────────

export default function ReviewNpc({ npc, onPatch, accent, dropped, apiCfg }) {
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
          <div style={{ fontSize: 10, color: "#8a8270", marginTop: 5 }}>
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
      <Section title="人设正文（注入 2／6 号位，不外显）">
        <TextField label={null} rows={7} value={n.entry} onChange={v => onPatch({ entry: v })} />
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
          <div key={m.threshold} style={{ marginBottom: 9, paddingBottom: 8, borderBottom: "1px dashed #2a2419" }}>
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
              style={{ ...selStyle, textAlign: "left", fontSize: 10.5, lineHeight: 1.7, color: "#c8bfa0", resize: "vertical" }} />
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
        <div style={{ fontSize: 10, color: "#6a6250", marginTop: 4, lineHeight: 1.7 }}>
          {TIERS[cap]?.label}档的基准是 {TIER_NEIGONG[cap]}。
          气血由内功与体魄算出：<span style={{ color: "#d4a853" }}>{maxHp}</span>
          {atk != null ? <>；出手威力由外功算出：<span style={{ color: "#d4a853" }}>{atk}</span></> : null}
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
        <PortraitPicker value={n.portrait || ""} onChange={v => onPatch({ portrait: v })} />
      </Section>

      {/* 15 落脚 */}
      <Section title="落脚 · 他会出现在哪">
        <Placement value={n.placement} accent={accent} npc={n} apiCfg={apiCfg}
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
