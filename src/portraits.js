// 立绘系统
// 管理对话场景中出现的立绘图片（旁白/主角/场景内任意角色），
// 独立于游戏状态存储（图片本身是 base64，体积较大，单独存一个 key，
// 避免把自动存档搞得很臃肿）。
//
// 数据结构：{ [角色名]: base64DataUrl }，"旁白" 和 "你" 是两个特殊的固定键，
// 其余键是任意 NPC 姓名（跟 MVU 变量树里的角色名对应即可）。
//
// 建议图片比例 9:16（竖版立绘），但不强制校验，只在 UI 上给出比例参考框。

// ── 默认立绘：硬加载（本轮改造，替代此前的 fetch+localStorage 预置方案）──
// 之前的做法是把图片放在 public/ 目录，组件挂载时异步 fetch 转 base64 再
// 写进 localStorage——这套方案有个先天的时序问题：图片要等一次网络请求
// （哪怕是同源静态资源）才能用上，且首次启动之后这批数据混进了
// localStorage，跟玩家自己上传的立绘存在同一个 key 下，边界处理复杂。
//
// 现在改成标准的 Vite 静态 import：图片文件放进 src/assets/portraits/，
// 构建时作为模块依赖直接打包进产物，组件渲染时立刻可用，不需要任何
// 异步初始化、不占用 localStorage 一个字节。玩家自定义上传的立绘依然
// 走 localStorage（见 setPortrait/loadPortraits），两者在 getPortrait()
// 里合并查询——玩家自己传的优先，没传过才落到这批硬加载的默认图。
import meiduoImg from "./assets/portraits/meiduo.jpg";
import huyanxueImg from "./assets/portraits/huyanxue.jpg";
import heyuxieImg from "./assets/portraits/heyuxie.jpg";
import caidanImg from "./assets/portraits/caidan.jpg";
import liruoyouImg from "./assets/portraits/liruoyou.jpg";
import zhuomaImg from "./assets/portraits/zhuoma.jpg";
import lanjieImg from "./assets/portraits/lanjie.jpg";
import luoqiImg from "./assets/portraits/luoqi.jpg";
import gazeImg from "./assets/portraits/gaze.jpg";

// key 是角色名（跟 MVU 变量树/room.npcs 里的名字对应），value 是 Vite
// 处理过的图片 URL（构建后指向打包产物里的静态资源路径，不是 base64，
// 但对调用方而言用法完全一样——直接当 <img src={...}> 用）。
export const DEFAULT_PORTRAITS = {
  梅朵: meiduoImg,
  呼延雪: huyanxueImg,
  何雨谢: heyuxieImg,
  才旦: caidanImg,
  李若由: liruoyouImg,
  卓玛: zhuomaImg,
  兰姐: lanjieImg,
  罗琦: luoqiImg,
  嘎则: gazeImg,
};

const PORTRAIT_STORAGE_KEY = "wuxia_mud_portraits";

export function loadPortraits() {
  try {
    const raw = localStorage.getItem(PORTRAIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePortraits(portraits) {
  try {
    localStorage.setItem(PORTRAIT_STORAGE_KEY, JSON.stringify(portraits));
    return true;
  } catch (e) {
    console.error("立绘保存失败，可能是 localStorage 容量已满", e);
    return false;
  }
}

export function setPortrait(name, dataUrl) {
  const all = loadPortraits();
  all[name] = dataUrl;
  return savePortraits(all);
}

export function removePortrait(name) {
  const all = loadPortraits();
  delete all[name];
  return savePortraits(all);
}

// 查询顺序：玩家自己上传过的（localStorage）优先 > 硬加载的默认图
// （DEFAULT_PORTRAITS，构建时静态打包）> 都没有则 null。
// 这个优先级顺序保证玩家如果不满意默认立绘、自己传了张新的，能立刻
// 覆盖生效，不会被硬加载的默认图挡住。
export function getPortrait(name) {
  const uploaded = loadPortraits();
  if (uploaded[name]) return uploaded[name];
  return DEFAULT_PORTRAITS[name] || null;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── 默认立绘预置（本轮新增）──
// 项目自带 public/default-portraits/ 下的8张固定立绘（梅朵/呼延雪/何雨谢/
// 才旦/李若由/卓玛/兰姐/罗琦），首次启动时自动写进 localStorage，玩家不用
// 根据当前场景状态，推断"应该显示谁的立绘"：
// 私聊模式 → 旁白；对话模式 → 优先用玩家点了"对话"的那个具体NPC（talkTarget），
// 房间里游走人口一多，"只有一个NPC"这个旧启发式基本就失效了，所以talkTarget
// 才是真正可靠的依据，房间只有一个NPC只作为没有talkTarget时的兜底；否则 → 主角本人（"你"）
export function inferActivePortraitTarget(interactMode, room, talkTarget) {
  if (interactMode === "whisper") return "旁白";
  if (interactMode === "talk") return talkTarget || (room.npcs?.length === 1 ? room.npcs[0].name : "你");
  return "你";
}
