// ── 选项延时浮现（原 commitRound 内嵌块）──

export function emitChoices(d) {
  if (d.p.choices?.length) {
    const choiceLog = [{ t: "sys", text: "" }, { t: "choice", text: "  你可以：" }, ...d.p.choices.map((c, i) => ({ t: "choice", text: `  [${String.fromCharCode(65 + i)}] ${c}`, action: c }))];
    setTimeout(() => d.addLog(choiceLog), 650);
  }
}
