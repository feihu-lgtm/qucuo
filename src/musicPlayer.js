// 音乐引擎 · 曲库数据 / Audio 单例 / 持久化
// ============================================================================
// 【为什么这个文件要能在 node 里被 import】
// 原来第一行就是 `let currentTrackId = localStorage.getItem(...)`，模块顶层裸读
// localStorage。两个后果：
//   ① 隐私模式或 localStorage 被策略禁用时，**整个 app 在 import 阶段就抛**，
//      表现是全站白屏，而不是"音乐坏了"——排查方向会被彻底带偏；
//   ② 任何想给音乐写测试的人，node 环境下 import 即炸，所以这个模块一条测试
//      都没有，②③④那几个 bug 才能一路带着 507/507 全绿上线。
// 现在 localStorage 和 Audio 都走可选探测：拿不到就降级成内存态 / 空操作，
// 绝不抛。副作用是这个文件可以被 vitest 直接 import，见 musicPlayer.test.js。

// 【为什么必须走 BASE_URL】Pages 把站点部在 /qucuo/ 子路径下（见
// vite.config.pages.js 的 base）。本地 mp3 原来写成 "/music/zood.mp3" 这种绝对
// 路径，线上会解析成 https://<user>.github.io/music/zood.mp3 —— 掉出仓库路径，
// 必 404。项目里其余 public 资源（stones/ portraits/ 开场图）一直都走 BASE_URL，
// 只有音乐漏了。docsTree.test.js 本来有一条守卫专门防这个，但它的正则
// `\/[A-Za-z0-9_-]+\.mp3` 不含斜杠，只抓得住顶层文件、抓不住带子目录的
// "/music/zood.mp3"，所以漏网了（那条正则这次一并修好）。
const BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";

// 曲库。本地曲子写 file（相对 public 根，**不带前导斜杠**，由 resolveTrackUrl 拼
// BASE）；外链曲子写 remote。两者互斥，resolveTrackUrl 负责统一出口。
export const TRACKS = [
  {
    id: "igs",
    title: "I Got Smoke",
    artist: "V在燃烧",
    remote: "https://archive.org/download/i-got-smoke/I%20Got%20Smoke%20%28320K%E6%9E%81%E9%AB%98%E9%9F%B3%E8%B4%A8%29.mp3",
    source: "https://audioaz.com/en/archive/archive-i-got-smoke",
    origin: "archive.org",
  },
  {
    id: "zood",
    title: "Zood",
    artist: "丁真",
    file: "music/zood.mp3",
    source: "https://audiomack.com/aviciiarmin-minecraft/song/zood",
    origin: "audiomack",
  },
  {
    id: "yan-distance",
    title: "烟 Distance",
    artist: "丁真 feat. 硫克克硫",
    file: "music/yan-distance.mp3",
    source: "https://audiomack.com/aviciiarmin-minecraft/song/yan-distance",
    origin: "audiomack",
  },
];

// 本地曲子拼 BASE，外链原样返回。纯函数，测试直接钉它。
export function resolveTrackUrl(track) {
  if (!track) return "";
  if (track.remote) return track.remote;
  if (!track.file) return "";
  return `${BASE}${String(track.file).replace(/^\/+/, "")}`;
}

// ── 存储：拿不到 localStorage 就退化成内存 Map，绝不抛 ──────────────────────
const memStore = new Map();
function storeGet(k) {
  try {
    const v = globalThis.localStorage?.getItem(k);
    return v == null ? (memStore.has(k) ? memStore.get(k) : null) : v;
  } catch {
    return memStore.has(k) ? memStore.get(k) : null;
  }
}
function storeSet(k, v) {
  memStore.set(k, String(v));
  try { globalThis.localStorage?.setItem(k, String(v)); } catch { /* 无痕模式等，只留内存态 */ }
}

const K_TRACK = "wuxia_mud_music_track";
const K_VOL = "wuxia_mud_music_vol";
const K_MODE = "wuxia_mud_music_mode";
// 没有存过偏好时的默认值。测试复位也用它，避免测试态与真实态分叉。
const DEFAULT_ENABLED = true;

let audio = null;
const listeners = new Set();
let currentTrackId = storeGet(K_TRACK) || TRACKS[0].id;
// 【默认开启】此前默认是关的，而顶栏那个 ♪ 音乐 按钮又只在开启时才渲染，
// 于是玩家进游戏根本看不到入口，得先自己翻到设置里勾一下才知道有音乐这回事。
// 改成默认开——注意这只是"功能可见"，**不会自动放音**：整个模块没有任何地方
// 在加载时调 play()，getAudio() 也是懒创建，声音只在玩家主动点播放/点曲目时才出。
// 已经显式关过的老玩家不受影响：只有在存档里压根没有这个键时才取默认值，
// 存了 "0" 的照旧保持关闭。
const savedMode = storeGet(K_MODE);
let enabled = savedMode == null ? DEFAULT_ENABLED : savedMode === "1";
// 最近一次失败原因（人话）。null 表示没出错。play() 的 rejection 原来被
// `.catch(() => {})` 整个吞掉，于是"点了没声音也没提示"，这是最难查的那种坏。
let lastError = null;
// 音量在没有 Audio 的环境下也要记得住，所以单独存一份，不依赖 audio.volume
let volume = clamp01(parseFloat(storeGet(K_VOL) ?? "0.5"));

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

export function currentTrack() {
  return TRACKS.find(t => t.id === currentTrackId) || TRACKS[0];
}

// MEDIA_ERR_* → 人话。玩家不需要知道 code 4 叫 SRC_NOT_SUPPORTED，
// 他需要知道"这首歌的文件没找到"。
function describeMediaError(err) {
  if (!err) return null;
  switch (err.code) {
    case 1: return "加载被中断";
    case 2: return "网络错误，取不到音频";
    case 3: return "音频解码失败，文件可能损坏";
    case 4: return "找不到音频文件（曲库文件缺失或路径不对）";
    default: return "音频加载失败";
  }
}

// play() 的 rejection → 人话。自动播放拦截和"文件不存在"是完全不同的两件事，
// 提示必须分开，否则玩家会一直去点播放键而问题其实在别处。
function describePlayError(e) {
  const name = e?.name || "";
  if (name === "NotAllowedError") return "浏览器拦截了自动播放，请再点一次播放键";
  if (name === "NotSupportedError") return "找不到音频文件（曲库文件缺失或路径不对）";
  if (name === "AbortError") return "播放被中断";
  return e?.message ? `播放失败：${e.message}` : "播放失败";
}

function getAudio() {
  if (typeof Audio === "undefined") return null; // node / SSR：全部降级为空操作
  if (!audio) {
    audio = new Audio(resolveTrackUrl(currentTrack()));
    audio.loop = true;
    audio.volume = volume;
    audio.addEventListener("play", () => { lastError = null; emit(); });
    audio.addEventListener("pause", () => emit());
    audio.addEventListener("ended", () => emit());
    audio.addEventListener("error", () => {
      lastError = describeMediaError(audio.error) || "音频加载失败";
      emit();
    });
  }
  return audio;
}

function emit() {
  const s = getState();
  listeners.forEach(fn => { try { fn(s); } catch { /* 单个订阅者出错不连坐 */ } });
}

export function getState() {
  const a = audio; // 刻意不调 getAudio()：读状态不该顺手 new 出一个 Audio 来
  return {
    playing: a ? (!a.paused && !a.ended) : false,
    volume,
    trackId: currentTrackId,
    enabled,
    error: lastError,          // 字符串或 null；面板要把它渲染出来
    track: currentTrack(),
  };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// 统一的起播口。enabled 关着就不放声——这是"音乐模式"这个开关唯一有意义的地方。
// 原来 playTrack/toggleMusic 都不看 enabled，关掉只是 pause() 一次，之后任何
// 路径调 playTrack 照样出声，那个开关等于纯装饰。
function startPlayback() {
  const a = getAudio();
  if (!a) return;
  if (!enabled) { lastError = "音乐模式未开启"; emit(); return; }
  a.play().then(() => { lastError = null; emit(); }).catch(e => {
    lastError = describePlayError(e);
    emit();
  });
}

export function toggleMusic() {
  const a = getAudio();
  if (!a) return;
  if (a.paused) startPlayback();
  else { a.pause(); emit(); }
}

export function playTrack(id) {
  const track = TRACKS.find(t => t.id === id);
  if (!track) return;
  currentTrackId = id;
  storeSet(K_TRACK, id);
  lastError = null;
  const a = getAudio();
  if (!a) { emit(); return; }
  a.src = resolveTrackUrl(track);
  a.load();
  startPlayback();
}

export function setVolume(v) {
  volume = clamp01(v);
  storeSet(K_VOL, volume);
  const a = audio;
  if (a) a.volume = volume;
  emit();
}

export function isMusicEnabled() {
  return enabled;
}

export function setMusicEnabled(on) {
  enabled = !!on;
  storeSet(K_MODE, enabled ? "1" : "0");
  if (!enabled) {
    const a = audio;
    if (a) a.pause();
    lastError = null;
  }
  emit(); // enabled 现在进了 getState()，订阅者（顶栏按钮）才能跟着变
}

// 测试用：把模块态复位。生产代码不该调。
export function __resetForTests() {
  audio = null; listeners.clear(); memStore.clear();
  currentTrackId = TRACKS[0].id; enabled = DEFAULT_ENABLED; lastError = null; volume = 0.5;
}
