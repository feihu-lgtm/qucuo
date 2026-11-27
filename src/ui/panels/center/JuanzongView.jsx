// 卷宗：江湖栏的第二档视图，一行一事地看每回合发生了什么。
// 只有三个过滤（全部 / 账 / 异常）和一个「机器」开关；键盘 j、k 上下，回车展开，鼠标点一行也能展开。
// 数据由 journalModel.buildJournal 拼装：主栏日志来自存档，机器明细来自内存里的全流程追踪。
import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "../../../store/gameStore.js";
import { useTurnTrace } from "../../hooks/useTurnTrace.js";
import { JOURNAL_FILTERS, buildJournal } from "./journalModel.js";

export default function JuanzongView({ hidden }) {
  const log = useGameStore((s) => s.log);
  const trace = useTurnTrace();
  const [filter, setFilter] = useState("all");
  const [machine, setMachine] = useState(false);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const bodyRef = useRef(null);

  const blocks = useMemo(
    () => buildJournal(log, trace?.trees || [], { filter, machine }),
    [log, trace, filter, machine],
  );
  const rowIds = useMemo(() => blocks.flatMap((block) => block.rows.map((row) => row.id)), [blocks]);

  useEffect(() => {
    if (hidden) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [hidden, filter, machine, blocks.length]);

  const toggle = (id) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const onKeyDown = (event) => {
    if (!rowIds.length) return;
    const index = rowIds.indexOf(selected);
    if (event.key === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      setSelected(rowIds[Math.min(rowIds.length - 1, index + 1)]);
    } else if (event.key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelected(rowIds[Math.max(0, index < 0 ? rowIds.length - 1 : index - 1)]);
    } else if (event.key === "Enter" && selected) {
      event.preventDefault();
      toggle(selected);
    }
  };

  useEffect(() => {
    if (!selected) return;
    bodyRef.current?.querySelector?.(`[data-row-id="${selected}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  if (hidden) return null;

  const filterButtons = JOURNAL_FILTERS.map((item) => (
    <button
      key={item.id}
      type="button"
      className="journal-chip"
      data-on={filter === item.id}
      aria-pressed={filter === item.id}
      onClick={() => setFilter(item.id)}
    >
      {item.label}
    </button>
  ));

  const sections = blocks.map((block) => {
    const rows = block.rows.map((row) => {
      const isOpen = open.has(row.id);
      return (
        <div key={row.id} className="journal-row-wrap">
          <button
            type="button"
            className="journal-row"
            data-row-id={row.id}
            data-src={row.src}
            data-sel={selected === row.id}
            aria-expanded={row.detail ? isOpen : undefined}
            onClick={() => { setSelected(row.id); if (row.detail) toggle(row.id); }}
          >
            <span className="journal-label">{row.label}</span>
            <span className="journal-text">{row.text}</span>
            <span className="journal-meta">{row.meta}</span>
          </button>
          {isOpen && row.detail && <pre className="journal-detail">{row.detail}</pre>}
        </div>
      );
    });
    return (
      <section key={block.key} className="journal-block">
        {(block.clock || block.cmd) && (
          <div className="journal-head">
            {block.clock && <span className="journal-clock">{block.clock}</span>}
            {block.cmd && <span className="journal-cmd">你　{block.cmd}</span>}
          </div>
        )}
        {rows}
        {block.expired && <div className="journal-expired">机器明细已过期，只保留最近 40 个回合</div>}
      </section>
    );
  });

  return (
    <div className="journal" data-testid="journal-view">
      <div className="journal-bar">
        <div className="journal-filters" role="group" aria-label="卷宗过滤">{filterButtons}</div>
        <button
          type="button"
          className="journal-chip journal-machine"
          data-on={machine}
          aria-pressed={machine}
          onClick={() => setMachine((on) => !on)}
        >
          机器
        </button>
      </div>
      <div ref={bodyRef} className="journal-body" tabIndex={0} onKeyDown={onKeyDown} aria-label="卷宗">
        {sections.length ? sections : <div className="journal-empty">这一类还没有记录。</div>}
      </div>
      <div className="journal-keys">j k 上下　回车展开</div>
    </div>
  );
}
