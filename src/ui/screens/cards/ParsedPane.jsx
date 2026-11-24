// 入册 · 归类与勾选（解析结果名单与认人/扫描入口，从 CardImportScreen.jsx 拆出）
import React, { useMemo } from "react";
import { S, KIND_META, Bar, Stat, Note, Btn, Pills, Terminal } from "./widgets.jsx";

export default 
function ParsedPane({
  parsed, accent, plan, stage, playerMode, asPlayer, insertMode, setInsertMode,
  picked, setPicked,
  openingIdx, setOpeningIdx, waitMs, err, onScan, onSkip, onImportLore, onAbort, term, onExpandTerm,
  classified, classifying, onClassify,
}) {
  const { card, report, npcLoreCandidates, unclassified, worldCandidates, metaEntries } = parsed;
  const scanning = stage === "scanning";

  // 认过人之后，名单整个换成 AI 那份——它已经把「三霄」「血角」这类
  // 标签与关键词同名、机器判据够不着的条目认出来了，不再分「候选/待定」两栏。
  const cands = useMemo(() => {
    if (classified) {
      return classified.people.map(p => ({
        name: p.name, aliases: p.aliases, len: p.len,
        merged: p.merged, sure: true, byAi: true, grouped: p.from === "ai",
      }));
    }
    return [
      ...npcLoreCandidates.map(c => ({ name: c.name, aliases: c.aliases, len: c._meta.length, merged: c._meta.mergedFrom.length, sure: true })),
      ...unclassified.map(u => ({ name: u.keys[0] || u.label, aliases: u.keys.slice(1), len: u.length, merged: 0, sure: false })),
    ];
  }, [classified, npcLoreCandidates, unclassified]);

  const toggle = (n) => setPicked(p => {
    const s = new Set(p);
    s.has(n) ? s.delete(n) : s.add(n);
    return s;
  });

  return (
    <>
      <div style={{ width: 340, borderRight: "1px solid var(--bg-card)", display: "flex", flexDirection: "column" }}>
        <Bar right={<span style={{ fontSize: "var(--fs-2xs)", color: "var(--muted)" }}>{card.entries.length} 条</span>}>
          {card.name || "无名卡"}
        </Bar>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
          <Stat label="世界书" v={`${card.entries.length} 条 / ${report.stats.totalLength} 字`} />
          <Stat label="开场白" v={`${card.openings.length} 个`} />
          <Stat label="可用兜底字段" v={report.stats.usableFields.join("、") || "无"} />
          {report.blockers.map((b, i) => <Note key={i} tone="bad">{b.msg}</Note>)}
          {report.warnings.map((w, i) => <Note key={i} tone="warn">{w.msg}</Note>)}
          <div style={{ marginTop: 12, borderTop: "1px solid var(--bg-card)", paddingTop: 10 }}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginBottom: 6 }}>归类结果</div>
            {[["person", cands.filter(c => c.sure).length], ["faction/place/rule", worldCandidates.length],
              ["meta", metaEntries.length], ["unknown", unclassified.length]].map(([k, n]) => {
              const m = KIND_META[k] || KIND_META.unknown;
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, marginBottom: 3, color: "var(--quest-stage-desc)" }}>
                  <span style={{ color: m.color }}>{m.icon}</span>
                  <span style={{ flex: 1 }}>{k === "faction/place/rule" ? "世界观" : m.label}</span>
                  <span style={{ color: n ? accent : "var(--muted)" }}>{n}</span>
                </div>
              );
            })}
          </div>
        </div>
        <Terminal lines={term} height={126} onExpand={onExpandTerm} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Bar>{playerMode ? "导入为主角" : "入册名单"}</Bar>

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
          {!classified && !scanning && (
            <div style={{
              display: "flex", alignItems: "center", gap: 9, marginBottom: 10,
              padding: "8px 10px", borderRadius: 0,
              background: "rgba(122,154,112,.08)", border: "1px solid var(--music-idle-icon)",
            }}>
              <div style={{ flex: 1, fontSize: 10.5, color: "var(--tavern-steam)", lineHeight: 1.7 }}>
                下面这份名单是按标签与关键词猜的，标「待定」的机器分不出是人是概念。
                让 AI 通读一遍正文能认得准得多。
              </div>
              <Btn onClick={onClassify} tone="main" disabled={classifying || !report.ok}>
                {classifying ? "认人中…" : "先认人"}
              </Btn>
            </div>
          )}
          {classified && !scanning && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, fontSize: 10.5, color: "var(--quest-success-text)" }}>
              <span>AI 通读正文后认出 {classified.people.length} 人</span>
              {!!classified.multiPerson.length && (
                <span style={{ color: "var(--tutorial-time)" }}>
                  · {classified.multiPerson.length} 条塞了多人（{classified.multiPerson.map(m => (m.人名 || []).join("/")).join("；").slice(0, 40)}）
                </span>
              )}
              <span style={{ flex: 1 }} />
              <span onClick={onClassify} title="重新认一遍（走缓存，不额外花调用）"
                style={{ cursor: "pointer", color: "var(--text-dim)" }}>重认</span>
            </div>
          )}
          {classified && !scanning && !playerMode && (
            <div style={{
              marginBottom: 11, padding: "9px 11px", borderRadius: 0,
              background: "rgba(0,0,0,.22)", border: "1px solid var(--bg-card)",
            }}>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginBottom: 6 }}>这批人想怎么插入曲措乡</div>
              <Pills accent={accent} value={insertMode} onChange={setInsertMode}
                options={[
                  { value: "npc", label: "当江湖众人", title: "正常入册成 NPC，会真的出现在据点、可结交切磋；扫完自动按营生荐位" },
                  { value: "lore", label: "只当背景传闻", title: "不进名单，只把设定塞进世界书，被提到时才浮现" },
                ]} />
              <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginTop: 6, lineHeight: 1.6 }}>
                {insertMode === "npc"
                  ? "选中的人会成为真正的江湖人物，需要 AI 补一版数值与落脚。"
                  : "选中的人不出现在任何据点，只作为被提及时注入的传闻设定。"}
              </div>
            </div>
          )}
          {!cands.length && (
            <div style={{ color: "var(--text-dim)", fontSize: 11.5, padding: "20px 0", textAlign: "center" }}>
              这张卡里没找到可以单独成人的条目。<br />
              {report.stats.usableFields.length
                ? "人设写在卡的经典字段里，勾上「这张卡也当我自己」就能用。"
                : "可以直接跳过，之后手写。"}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {cands.map(c => {
              const on = picked.has(c.name);
              return (
                <div key={c.name} onClick={scanning ? undefined : () => toggle(c.name)}
                  style={{
                    cursor: scanning ? "default" : "pointer", padding: "8px 10px", borderRadius: 0,
                    border: `1px solid ${on ? accent : "var(--bg-card)"}`,
                    background: on ? "rgba(212,168,83,.10)" : "rgba(0,0,0,.25)",
                    transition: "all .15s ease",
                  }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: on ? accent : "var(--border)", fontSize: 12 }}>{on ? "◉" : "○"}</span>
                    <span style={{ color: "var(--paper)", fontSize: 12.5, flex: 1 }}>{c.name}</span>
                    {!c.sure && <span title="机器拿不准这是人还是概念，勾选前请自己看一眼"
                      style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-muted)", border: "1px solid var(--border-deep)", borderRadius: 0, padding: "0 3px" }}>待定</span>}
                    {c.grouped && <span title="AI 认出这几条写的是同一个人，已合并"
                      style={{ fontSize: "var(--fs-2xs)", color: "var(--quest-success-text)", border: "1px solid var(--music-idle-icon)", borderRadius: 0, padding: "0 3px" }}>合</span>}
                  </div>
                  <div style={{ fontSize: "var(--fs-2xs)", color: "var(--text-dim)", marginTop: 3, paddingLeft: 18 }}>
                    {c.aliases.length ? `别名 ${c.aliases.slice(0, 3).join("/")}` : "无别名"} · {c.len}字
                    {c.merged > 1 ? ` · 合${c.merged}段` : ""}
                  </div>
                </div>
              );
            })}
          </div>

          {asPlayer && card.openings.length > 1 && (
            <div style={{ marginTop: 14, borderTop: "1px solid var(--bg-card)", paddingTop: 10 }}>
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginBottom: 6 }}>这张卡有 {card.openings.length} 个开局，选一个改写</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {card.openings.map((o, i) => (
                  <span key={i} onClick={() => setOpeningIdx(i)} title={o.slice(0, 80)}
                    style={{
                      cursor: "pointer", fontSize: 10.5, padding: "3px 9px", borderRadius: 0,
                      border: `1px solid ${openingIdx === i ? accent : "var(--bg-card)"}`,
                      color: openingIdx === i ? accent : "var(--muted)",
                    }}>开局{i + 1}·{o.length}字</span>
                ))}
              </div>
            </div>
          )}

          {scanning && waitMs > 0 && (
            <Note tone="info">额度用完了，{Math.ceil(waitMs / 1000)} 秒后自动继续。过程见左下日志。</Note>
          )}
          {err && <Note tone="bad">{err}</Note>}
        </div>

        <div style={{
          borderTop: `1px solid color-mix(in srgb, ${accent} 27%, transparent)`, padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          backgroundImage: `url('${S("ui/bar_paper2.webp")}')`, backgroundSize: "100% 100%",
        }}>
          {plan && !scanning && (
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--muted)" }}>
              预计 <span style={{ color: accent }}>{plan.calls}</span> 次调用
              {plan.estimateMs > 0 && <> · 约 {Math.ceil(plan.estimateMs / 1000)} 秒</>}
              {plan.alreadyDone > 0 && <> · 已有 {plan.alreadyDone} 次结果可复用</>}
            </span>
          )}
          <span style={{ flex: 1 }} />
          {scanning ? (
            <Btn onClick={onAbort} tone="warn">中断</Btn>
          ) : (insertMode === "lore" && !playerMode) ? (
            <Btn onClick={onImportLore} tone="main" disabled={!picked.size}
              title={picked.size ? "把选中的人收作被提及时才浮现的传闻设定" : "先勾几个人"}>
              收作背景传闻 {picked.size} 人
            </Btn>
          ) : (
            <>
              <Btn onClick={onSkip} tone="dim" title="不调 AI，全部用默认值，之后自己改">跳过，手填</Btn>
              <Btn onClick={onScan} tone="main" disabled={!report.ok}
                title={report.ok ? "" : "这张卡被拦截了，不建议导入"}>
                <img src={S("ui/eye.webp")} alt="" style={{ width: 15, verticalAlign: "-2px", marginRight: 5 }} />
                让 AI 扫一遍
              </Btn>
            </>
          )}
        </div>
      </div>
    </>
  );
}

