// 轻量提示音：来信「叮」一声。无 AudioContext/被自动播放策略拦时静默不报错。
let audioCtx = null;

export function playLetterChime() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx ||= new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime;
    [[880, 0], [1320, 0.09]].forEach(([freq, at]) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + at);
      gain.gain.exponentialRampToValueAtTime(0.08, t0 + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.28);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.3);
    });
  } catch { /* 静默 */ }
}
