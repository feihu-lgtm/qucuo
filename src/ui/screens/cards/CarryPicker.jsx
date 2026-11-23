// 入册审改 · 随身物编辑（从 ReviewNpc.jsx 拆出）
import React, { useState, useMemo } from "react";
import { SEVEN, TIERS, selStyle } from "./widgets.jsx";
import { callModel } from "../../../engine/ports/ai.js";
import { CATALOG } from "../../../domain/data/items/catalog.js";
import { statsForQuality } from "../../../domain/rules/economy/equipment.js";
import { effectBrief } from "../../../domain/rules/economy/itemEffectText.js";
import { ITEM_DESC_MAX_TOKENS } from "./reviewShared.js";

// ── 随身物 ────────────────────────────────────────────────────────────────────

/**
 * 【默认为空是有意的】卡里没有物品信息，留空时运行时会走 rollNpcCarry 的四池
 * 随机抽（按品阶给武器/护甲/饰品/杂物），不至于两手空空。只有你想精确指定
 * 「这人身上一定有那把刀」时才需要在这儿挑。
 */
export default function CarryPicker({ carry, onChange, levelCap, apiCfg }) {
  const [cat, setCat] = useState("");
  const [qual, setQual] = useState("");
  const [kw, setKw] = useState("");
  const [forging, setForging] = useState(false);   // 是否展开"新造一件"
  const [draft, setDraft] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [detailItem, setDetailItem] = useState(null);   // 点随身物看详情（点名字展开，点 ✕ 才删）

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
  // 详情/新造都在编辑同一份「物品描述」。改一件已选的自造物：按名字替换回 carry。
  const patchItem = (name, patch) => onChange(carry.map(c =>
    nameOf(c) === name && typeof c === "object" ? { ...c, ...patch } : c));

  const blankDraft = () => ({
    name: "", category: cat || "weapon", quality: TIERS[levelCap]?.label || "白",
    desc: "", sixDim: {}, effect: {}, atkMul: 1, defMul: 1,
  });

  // 攻击特效的可勾选清单（物品版的武学标志位）。按 combat/resolveTurn.js 认的
  // 字段名，给出默认值——玩家只需勾"这件装备带不带某个效果"，数值交给默认。
  // applyMark 需要 name/stacks 这种结构，单独给默认对象。
  const ITEM_EFFECT_CHOICES = [
    { key: "forceFirst", label: "必先手", def: true },
    { key: "ignoreDefense", label: "无视防御", def: true },
    { key: "doubleVsStatus", label: "克中招翻倍", def: true },
    { key: "lowHpBonus", label: "残血增伤", def: 0.15 },
    { key: "highHpBonus", label: "满血增伤", def: 0.15 },
    { key: "afterStatusBonus", label: "趁中招追击", def: 0.2 },
    { key: "detonateMark", label: "引爆内伤", def: true },
    { key: "energyDiffDamage", label: "打能量差", def: true },
    { key: "freezeEnergyRecovery", label: "封气", def: true },
    { key: "onCounterSuccessDamageRatio", label: "应对反击", def: 0.5 },
    { key: "nullifyStatusOnHit", label: "打断状态招", def: true },
    { key: "immuneControl", label: "免控", def: true },
    { key: "energyRestore", label: "起手回气", def: 2 },
    { key: "hpRestore", label: "运功回血", def: 0.2 },
    { key: "applyMark", label: "附内伤印", def: { name: "内伤印", stacks: 1 }, param: "applyMarkChance", paramDef: 0.25 },
    { key: "enemyCostPenalty", label: "封穴耗气", def: { value: 2, turns: 2 } },
  ];

  // 某件（自造）物品当前挂着的 effect 里，某标志位是否为真（含 param 键辅助判断）
  const effectHas = (item, key) => {
    const e = item?.effect || {};
    if (key === "applyMark") return !!e.applyMark;
    if (key === "enemyCostPenalty") return !!e.enemyCostPenalty;
    return !!e[key];
  };

  // 勾选/取消某特效标志位。取消时把 param 键（如 applyMarkChance）一并清掉。
  const toggleEffect = (item, choice) => {
    const e = { ...(item.effect || {}) };
    if (effectHas(item, choice.key)) {
      delete e[choice.key];
      if (choice.param) delete e[choice.param];
    } else {
      e[choice.key] = choice.def;
      if (choice.param && e[choice.param] == null) e[choice.param] = choice.paramDef;
    }
    patchItem(nameOf(item), { effect: e });
  };

  // 一件物品（在册字符串或自造对象）算出的最终攻击力：
  //   在册 → catalog 条目自带 atkMul；自造 → 品质基准 × 玩家调的 atkMul。
  const computeAtk = (item) => {
    const isStr = typeof item === "string";
    const catEntry = isStr ? CATALOG.find(e => e.name === item) : null;
    const quality = catEntry ? catEntry.quality : (item?.quality || "白");
    const mul = catEntry ? (catEntry.atkMul ?? 1) : (item?.atkMul ?? 1);
    const base = statsForQuality(catEntry?.category || item?.category || "weapon", quality);
    return base.atk != null ? Math.round(base.atk * mul) : null;
  };
  // 护甲同理
  const computeDef = (item) => {
    const isStr = typeof item === "string";
    const catEntry = isStr ? CATALOG.find(e => e.name === item) : null;
    const quality = catEntry ? catEntry.quality : (item?.quality || "白");
    const mul = catEntry ? (catEntry.defMul ?? 1) : (item?.defMul ?? 1);
    const base = statsForQuality(catEntry?.category || item?.category || "armor", quality);
    return base.def != null ? Math.round(base.def * mul) : null;
  };

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
          <span style={{ fontSize: 10.5, color: "var(--ink-text-dim)" }}>
            未指定 · 运行时按 {TIERS[levelCap]?.label}档 从四池随机抽
          </span>
        )}
        {carry.map((c, i) => {
          const nm = nameOf(c);
          const custom = typeof c !== "string";
          const open = detailItem && nameOf(detailItem) === nm;
          return (
            <span key={nm + i}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 10.5, padding: "3px 4px 3px 8px", borderRadius: 0,
                border: `1px solid ${open ? "var(--ink-warn)" : custom ? "var(--service-hint)" : "var(--service-card-edge)"}`,
                background: custom ? "rgba(120,180,130,.10)" : "rgba(212,168,83,.10)", color: "var(--paper)",
              }}>
              <span onClick={() => setDetailItem(open ? null : c)} title="点看详情"
                style={{ cursor: "pointer" }}>{custom ? "⚒ " : ""}{nm}</span>
              <span onClick={() => { del(nm); if (open) setDetailItem(null); }} title="移除这件"
                style={{ cursor: "pointer", color: "var(--lore-amber)", fontSize: 11, padding: "0 2px" }}>✕</span>
            </span>
          );
        })}
      </div>

      {/* 随身物详情：点上面的名字展开。显示描述/伤害/攻击特效/六维；自造物可改，
          在册物只读（数值由百物录裁决，改它等于改全世界的设定）。 */}
      {detailItem && (() => {
        const custom = typeof detailItem !== "string";
        const catEntry = !custom ? CATALOG.find(e => e.name === detailItem) : null;
        const quality = custom ? detailItem.quality : (catEntry?.quality || "白");
        const category = custom ? detailItem.category : (catEntry?.category || "misc");
        const atk = computeAtk(detailItem);
        const def = computeDef(detailItem);
        const sixDim = custom && detailItem.sixDim ? Object.entries(detailItem.sixDim).filter(([, v]) => v) : [];
        const desc = custom ? detailItem.desc : (catEntry?.desc || "");
        const effectText = custom
          ? effectBrief(detailItem.effect, detailItem.sixDim)
          : effectBrief(catEntry?.effect, catEntry?.sixDim);
        return (
          <div style={{ marginBottom: 7, padding: "8px 10px", borderRadius: 0, border: "1px solid var(--service-card-edge)", background: "rgba(0,0,0,.3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ color: "var(--paper)", fontSize: 12 }}>{nameOf(detailItem)}</span>
              <span style={{ fontSize: 10, color: "var(--quest-stage-desc)" }}>
                {{ weapon: "兵器", armor: "护具", accessory: "饰物", misc: "杂物" }[category] || category} · {quality}档
              </span>
              <span style={{ flex: 1 }} />
              <span onClick={() => setDetailItem(null)} style={{ cursor: "pointer", fontSize: 10, color: "var(--ink-text-dim)" }}>收起</span>
            </div>

            {/* 伤害 / 防御 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              {atk != null && (
                <div style={{ fontSize: 10.5, color: "var(--attr-waigong-tag)" }}>
                  攻击力 <span style={{ color: "var(--service-item-name)", fontWeight: 700 }}>{atk}</span>
                  {custom && category === "weapon" && (
                    <span style={{ marginLeft: 6, color: "var(--ink-text-dim)", fontSize: 9.5 }}>
                      倍率
                      <input type="number" step={0.05} min={1} max={1.6}
                        value={detailItem.atkMul ?? 1}
                        onChange={e => patchItem(nameOf(detailItem), { atkMul: Math.max(1, Math.min(1.6, Number(e.target.value) || 1)) })}
                        style={{ width: 46, marginLeft: 4, textAlign: "center", background: "rgba(0,0,0,.4)", border: "1px solid var(--border-deep)", borderRadius: 0, color: "var(--service-item-name)", fontSize: 10 }} />
                    </span>
                  )}
                </div>
              )}
              {def != null && (
                <div style={{ fontSize: 10.5, color: "var(--footer-hint-title)" }}>
                  防御力 <span style={{ color: "var(--ink-sky-soft)", fontWeight: 700 }}>{def}</span>
                  {custom && category === "armor" && (
                    <span style={{ marginLeft: 6, color: "var(--ink-text-dim)", fontSize: 9.5 }}>
                      倍率
                      <input type="number" step={0.05} min={1} max={1.6}
                        value={detailItem.defMul ?? 1}
                        onChange={e => patchItem(nameOf(detailItem), { defMul: Math.max(1, Math.min(1.6, Number(e.target.value) || 1)) })}
                        style={{ width: 46, marginLeft: 4, textAlign: "center", background: "rgba(0,0,0,.4)", border: "1px solid var(--border-deep)", borderRadius: 0, color: "var(--ink-sky-soft)", fontSize: 10 }} />
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 描述：自造物可改，在册物只读 */}
            {custom ? (
              <textarea rows={2}
                value={detailItem.desc || ""}
                placeholder="写它什么样、什么手感或什么来历"
                onChange={e => patchItem(nameOf(detailItem), { desc: e.target.value.slice(0, 200) })}
                style={{ width: "100%", boxSizing: "border-box", background: "rgba(0,0,0,.35)", border: "1px solid var(--border-deep)", borderRadius: 0, padding: "5px 8px", color: "var(--ink-text)", fontSize: 10.5, lineHeight: 1.7, resize: "vertical", fontFamily: "inherit" }} />
            ) : (
              <div style={{ fontSize: 10.5, color: "var(--ink-text)", lineHeight: 1.6 }}>
                {desc || "在册物品，运行时按名字查百物录补全数值与词条。"}
              </div>
            )}

            {/* 攻击特效：自造物可勾选，在册物只读列出 */}
            {custom ? (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 10, color: "var(--ink-muted)", marginBottom: 4 }}>攻击特效 · 点一下加上/去掉</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {ITEM_EFFECT_CHOICES.map(choice => {
                    const on = effectHas(detailItem, choice.key);
                    return (
                      <span key={choice.key} onClick={() => toggleEffect(detailItem, choice)}
                        title={`${choice.def === true ? "" : `默认 ${JSON.stringify(choice.def)} `}装备时叠到招式上`}
                        style={{
                          cursor: "pointer", fontSize: 10, padding: "2px 7px", borderRadius: 0,
                          border: `1px solid ${on ? "var(--green-soft)" : "var(--bg-card)"}`,
                          color: on ? "var(--ci-pick)" : "var(--muted)",
                          background: on ? "rgba(138,176,112,.12)" : "transparent",
                        }}>{choice.label}</span>
                    );
                  })}
                </div>
              </div>
            ) : (
              effectText && (
                <div style={{ marginTop: 5, fontSize: 10, color: "var(--green-soft)" }}>特效：{effectText}</div>
              )
            )}

            {sixDim.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 10, color: "var(--green-soft)" }}>加成：{sixDim.map(([k, v]) => `${k}+${v}`).join("、")}</div>
            )}
          </div>
        );
      })()}

      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...selStyle, width: 96 }}>
          <option value="" style={{ background: "var(--bg-deep)" }}>全部类别</option>
          {cats.map(c => <option key={c} value={c} style={{ background: "var(--bg-deep)" }}>{c}</option>)}
        </select>
        <select value={qual} onChange={e => setQual(e.target.value)} style={{ ...selStyle, width: 78 }}>
          <option value="" style={{ background: "var(--bg-deep)" }}>全部品阶</option>
          {TIERS.map(t => (
            <option key={t.label} value={t.label} style={{ background: "var(--bg-deep)", color: t.color }}>{t.label}档</option>
          ))}
        </select>
        <input value={kw} onChange={e => setKw(e.target.value)} placeholder="搜名字或描述"
          style={{ ...selStyle, flex: 1 }} />
        <span onClick={() => { setForging(f => !f); if (!draft) setDraft(blankDraft()); }}
          title="造一件百物录里没有的东西"
          style={{
            cursor: "pointer", fontSize: 10.5, padding: "4px 10px", borderRadius: 0, whiteSpace: "nowrap",
            border: `1px solid ${forging ? "var(--green-soft)" : "var(--border-deep)"}`,
            color: forging ? "var(--green-soft)" : "var(--ink-muted)",
          }}>⚒ 新造一件</span>
      </div>

      {forging && draft && (
        <div style={{ marginBottom: 7, padding: "8px 10px", borderRadius: 0, border: "1px solid var(--music-idle-icon)", background: "rgba(120,180,130,.05)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input value={draft.name} placeholder="物件名"
              onChange={e => setDraft(d => ({ ...d, name: e.target.value.slice(0, 20) }))}
              style={{ ...selStyle, flex: 1, textAlign: "center" }} />
            <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))}
              style={{ ...selStyle, width: 84 }}>
              {["weapon", "armor", "accessory", "misc"].map(c => (
                <option key={c} value={c} style={{ background: "var(--bg-deep)" }}>
                  {{ weapon: "兵器", armor: "护具", accessory: "饰物", misc: "杂物" }[c]}
                </option>
              ))}
            </select>
            <select value={draft.quality} onChange={e => setDraft(d => ({ ...d, quality: e.target.value }))}
              style={{ ...selStyle, width: 72 }}>
              {TIERS.map(t => (
                <option key={t.label} value={t.label} style={{ background: "var(--bg-deep)", color: t.color }}>{t.label}档</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: 10, color: "var(--ink-muted)", marginBottom: 3 }}>
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
                    cursor: "pointer", fontSize: 10, padding: "2px 7px", borderRadius: 0,
                    border: `1px solid ${v ? "var(--green-soft)" : "var(--bg-card)"}`,
                    color: v ? "var(--ci-pick)" : "var(--muted)",
                  }}>{k}{v ? ` +${v}` : ""}</span>
              );
            })}
          </div>

          {/* 攻防倍率：兵器调 atkMul、护具调 defMul，显示成品攻击/防御力 */}
          {(draft.category === "weapon" || draft.category === "armor") && (
            <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
              {draft.category === "weapon" && (() => {
                const base = statsForQuality("weapon", draft.quality).atk ?? 0;
                const mul = draft.atkMul ?? 1;
                return (
                  <label style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 10, color: "var(--ink-muted)", marginBottom: 3 }}>
                      攻击力 {Math.round(base * mul)} · 倍率 {mul.toFixed(2)}
                    </span>
                    <input type="range" min={1} max={1.6} step={0.05} value={mul}
                      onChange={e => setDraft(d => ({ ...d, atkMul: Number(e.target.value) }))}
                      style={{ width: "100%", accentColor: "var(--attr-waigong-tag)" }} />
                  </label>
                );
              })()}
              {draft.category === "armor" && (() => {
                const base = statsForQuality("armor", draft.quality).def ?? 0;
                const mul = draft.defMul ?? 1;
                return (
                  <label style={{ flex: 1 }}>
                    <span style={{ display: "block", fontSize: 10, color: "var(--ink-muted)", marginBottom: 3 }}>
                      防御力 {Math.round(base * mul)} · 倍率 {mul.toFixed(2)}
                    </span>
                    <input type="range" min={1} max={1.6} step={0.05} value={mul}
                      onChange={e => setDraft(d => ({ ...d, defMul: Number(e.target.value) }))}
                      style={{ width: "100%", accentColor: "var(--footer-hint-title)" }} />
                  </label>
                );
              })()}
            </div>
          )}

          {/* 攻击特效：跟详情面板同一份可勾选清单 */}
          <div style={{ fontSize: 10, color: "var(--ink-muted)", marginBottom: 3 }}>攻击特效 · 点一下加上/去掉</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {ITEM_EFFECT_CHOICES.map(choice => {
              const on = effectHas(draft, choice.key);
              return (
                <span key={choice.key} onClick={() => {
                  const e = { ...(draft.effect || {}) };
                  if (effectHas(draft, choice.key)) {
                    delete e[choice.key];
                    if (choice.param) delete e[choice.param];
                  } else {
                    e[choice.key] = choice.def;
                    if (choice.param && e[choice.param] == null) e[choice.param] = choice.paramDef;
                  }
                  setDraft(d => ({ ...d, effect: e }));
                }}
                  title={`${choice.def === true ? "" : `默认 ${JSON.stringify(choice.def)} `}装备时叠到招式上`}
                  style={{
                    cursor: "pointer", fontSize: 10, padding: "2px 7px", borderRadius: 0,
                    border: `1px solid ${on ? "var(--green-soft)" : "var(--bg-card)"}`,
                    color: on ? "var(--ci-pick)" : "var(--muted)",
                    background: on ? "rgba(138,176,112,.12)" : "transparent",
                  }}>{choice.label}</span>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: "var(--ink-muted)", flex: 1 }}>描述</span>
            {apiCfg && (
              <span onClick={askAiDesc}
                title={draft.name ? "让 AI 照名字与品阶写两三句" : "先起个名"}
                style={{
                  cursor: draft.name && !aiBusy ? "pointer" : "default", fontSize: 10,
                  color: draft.name && !aiBusy ? "var(--ink-info)" : "var(--building-desc)",
                }}>{aiBusy ? "写着…" : "✎ 让 AI 写"}</span>
            )}
          </div>
          <textarea rows={3} value={draft.desc}
            placeholder="自己写，或让 AI 写完再改"
            onChange={e => setDraft(d => ({ ...d, desc: e.target.value.slice(0, 200) }))}
            style={{ ...selStyle, width: "100%", textAlign: "left", resize: "vertical", lineHeight: 1.7 }} />

          <div style={{ display: "flex", gap: 6, marginTop: 7, alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--ink-text-dim)", flex: 1 }}>
              造出来的东西只属于这个人，不进百物录
            </span>
            <span onClick={() => { setDraft(blankDraft()); }}
              style={{ cursor: "pointer", fontSize: 10.5, color: "var(--ink-text-dim)" }}>清空</span>
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
                padding: "4px 12px", borderRadius: 0, fontWeight: 700,
                color: draft.name.trim() ? "var(--bg-deep)" : "var(--muted)",
                background: draft.name.trim() ? "linear-gradient(180deg,var(--tutorial-move),var(--ink-good))" : "rgba(0,0,0,.3)",
                border: `1px solid ${draft.name.trim() ? "var(--tutorial-move)" : "var(--border-deep)"}`,
              }}>⚒ 造好，收进他身上</span>
          </div>
        </div>
      )}

      {/* 计数条：让"库里到底有多少、我筛掉了多少"始终可见。原来静默截断到 60 件，
          玩家没法知道自己看的是全部还是一角 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "3px 8px",
        fontSize: 9.5, color: "var(--ink-text-dim)", background: "rgba(0,0,0,.3)",
        border: "1px solid var(--bg-card)", borderBottom: "none", borderRadius: 0,
      }}>
        <span>百物录 {CATALOG.length} 件</span>
        {list.length !== CATALOG.length && <span style={{ color: "var(--quest-stage-desc)" }}>· 当前 {list.length} 件</span>}
        <span style={{ flex: 1 }} />
        {carry.length ? <span style={{ color: "var(--ink-warn)" }}>已选 {carry.length}</span> : null}
      </div>

      <div style={{
        maxHeight: "min(38vh, 380px)", overflowY: "auto",
        border: "1px solid var(--bg-card)", borderRadius: "0 0 3px 3px", background: "rgba(0,0,0,.22)",
      }}>
        {!list.length && <div style={{ padding: 8, fontSize: 10.5, color: "var(--ink-text-dim)" }}>没有匹配的物件</div>}
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
                borderBottom: "1px solid var(--gamble-panel)",
              }}>
              <span style={{ color: on ? "var(--ink-warn)" : "var(--gamble-button-edge)", width: 10 }}>{on ? "◉" : "○"}</span>
              <span style={{ color: tier?.color || "var(--quest-stage-desc)", width: 14 }}>{e.quality || "—"}</span>
              <span style={{ color: "var(--ink-text)", flex: 1 }}>{e.name}</span>
              <span style={{ color: "var(--muted)", fontSize: 9.5 }}>{e.category}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

