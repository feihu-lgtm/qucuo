export const TRACKS = [
  {
    id: "igs",
    title: "I Got Smoke",
    artist: "V在燃烧",
    url: "https://archive.org/download/i-got-smoke/I%20Got%20Smoke%20%28320K%E6%9E%81%E9%AB%98%E9%9F%B3%E8%B4%A8%29.mp3",
    source: "https://audioaz.com/en/archive/archive-i-got-smoke",
  },
  {
    id: "zood",
    title: "Zood",
    artist: "丁真",
    url: "/music/zood.mp3",
    source: "https://audiomack.com/aviciiarmin-minecraft/song/zood",
  },
  {
    id: "yan-distance",
    title: "烟 Distance",
    artist: "丁真 feat. 硫克克硫",
    url: "/music/yan-distance.mp3",
    source: "https://audiomack.com/aviciiarmin-minecraft/song/yan-distance",
  },
];

let audio = null;
let listeners = new Set();
let currentTrackId = localStorage.getItem("wuxia_mud_music_track") || TRACKS[0].id;

function getAudio() {
  if (!audio) {
    const track = TRACKS.find(t => t.id === currentTrackId) || TRACKS[0];
    audio = new Audio(track.url);
    audio.loop = true;
    audio.volume = parseFloat(localStorage.getItem("wuxia_mud_music_vol") ?? "0.5");
    audio.addEventListener("play", () => emit());
    audio.addEventListener("pause", () => emit());
    audio.addEventListener("ended", () => emit());
    audio.addEventListener("error", () => emit());
  }
  return audio;
}

function emit() {
  const s = getState();
  listeners.forEach(fn => fn(s));
}

export function getState() {
  const a = getAudio();
  return { playing: !a.paused && !a.ended, volume: a.volume, trackId: currentTrackId, error: a.error ? true : false };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function toggleMusic() {
  const a = getAudio();
  if (a.paused) {
    a.play().catch(() => {});
  } else {
    a.pause();
  }
  emit();
}

export function playTrack(id) {
  const track = TRACKS.find(t => t.id === id);
  if (!track) return;
  currentTrackId = id;
  localStorage.setItem("wuxia_mud_music_track", id);
  const a = getAudio();
  a.src = track.url;
  a.load();
  a.play().catch(() => {});
  emit();
}

export function setVolume(v) {
  const a = getAudio();
  a.volume = Math.max(0, Math.min(1, v));
  localStorage.setItem("wuxia_mud_music_vol", String(a.volume));
  emit();
}

export function isMusicEnabled() {
  return localStorage.getItem("wuxia_mud_music_mode") === "1";
}

export function setMusicEnabled(on) {
  localStorage.setItem("wuxia_mud_music_mode", on ? "1" : "0");
  if (!on) getAudio().pause();
  emit();
}
