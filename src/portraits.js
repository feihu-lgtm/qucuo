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
import { affectionTier } from "./narrator.js";

import meiduoImg from "./assets/portraits/meiduo.webp";
import huyanxueImg from "./assets/portraits/huyanxue.webp";
import heyuxieImg from "./assets/portraits/heyuxie.webp";
import caidanImg from "./assets/portraits/caidan.webp";
import liruoyouImg from "./assets/portraits/liruoyou.webp";
import zhuomaImg from "./assets/portraits/zhuoma.webp";
import lanjieImg from "./assets/portraits/lanjie.webp";
import luoqiImg from "./assets/portraits/luoqi.webp";
import gazeImg from "./assets/portraits/gaze.webp";
import xuannuImg from "./assets/portraits/xuannu.webp";

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
  玄女: xuannuImg,
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

// 从「已在 state 里的玩家上传立绘」+「内置默认立绘」两处解析出该显示哪张。
// 玩家自己传的优先，没传过才落到内置那批。
//
// 【为什么要有这个函数、而不是各处直接写 portraits[name]】
// 曾经有过一次半途而废的重构：默认立绘从"异步写进 localStorage"改成"静态 import
// 打包"，初始化那个 useEffect 被删掉了，但**读取侧一直没接上**——LeftPanel 与
// PortraitManager 读的都是 portraits[name]（只含玩家上传的那份 state），
// DEFAULT_PORTRAITS 除了注释里被提起之外无人读取，getPortrait() 虽然写好了却
// 从未被调用。结果内置的九张立绘（梅朵/呼延雪/何雨谢/才旦/李若由/卓玛/兰姐/
// 罗琦/嘎则）全都打进了产物、却一张都没显示过。
// 收敛成这一个函数，两处读取共用，以后再加内置立绘只改一处、不会再漏。
//
// 注意与 getPortrait() 的分工：getPortrait() 自己去读 localStorage（供非 React
// 场景用），这个函数接收已有的 state 对象（供组件渲染用，跟着 state 走、可响应更新）。
export function resolvePortrait(uploadedPortraits, name) {
  if (!name) return null;
  return uploadedPortraits?.[name] || DEFAULT_PORTRAITS[name] || null;
}

// 这个角色有没有内置立绘（UI 上区分"内置"与"玩家自传"用）。
export function hasBuiltinPortrait(name) {
  return !!DEFAULT_PORTRAITS[name];
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── 雪豹立绘·三形态（本轮新增）──
// 伙伴雪豹有三张官方立绘：两张人形（前世羁绊的人形相）+ 一张雪豹真身。
// 资源放在 public/portraits/snowleopard/ 下——刻意不走 src/assets 硬加载：
// 图片由作者自行投放，构建不该依赖文件是否存在；缺失时界面上给占位提示，
// 不影响构建与游戏运行（跟 public/portraits/player/ 玩家头像同一套思路）。
const SL_BASE = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "portraits/snowleopard/";
export const SNOW_LEOPARD_FORMS = [
  { key: "form1", label: "人形·立雪", file: "form1.webp" },
  { key: "form2", label: "人形·倚剑", file: "form2.webp" },
  { key: "beast", label: "雪豹真身", file: "beast.webp" },
];
const SL_FORM_KEY = "qucuo_snowleopard_form";
// 默认"雪豹真身"——村里见到的是野兽形态的她；人形两相留给玩家自行切换
export function getSnowLeopardForm() {
  try {
    const v = localStorage.getItem(SL_FORM_KEY);
    return SNOW_LEOPARD_FORMS.some(f => f.key === v) ? v : "beast";
  } catch { return "beast"; }
}
export function setSnowLeopardForm(key) {
  try { localStorage.setItem(SL_FORM_KEY, key); } catch { /* ignore */ }
}
export function snowLeopardPortraitUrl(formKey) {
  const f = SNOW_LEOPARD_FORMS.find(x => x.key === formKey) || SNOW_LEOPARD_FORMS[2];
  return SL_BASE + f.file;
}

// ── 旁白立绘·好感度五档（本轮新增）──
// 跟雪豹三形态同一套思路：资源放 public/portraits/narrator/ 下，不走 src/assets
// 硬加载——图片由作者自行投放，构建不该依赖文件是否存在；缺失时界面给占位提示，
// 不影响构建与运行。
//
// 与雪豹的差别：雪豹三形态是**玩家手动切**（她本来就会变，切哪个是玩家喜好），
// 旁白这五张是**好感度自动切**，玩家不能选——这五张是她显形的进度条，
// 一路从"一团声音"长到"人"：
//   ≥0  声之涟漪   她只是个声音，光环里空着，位置留着人没来
//   ≥20 水手服的猫  傲娇、有攻击性、脖子上拴着红项圈
//   ≥45 猫裹黄裙   衣服是人的尺寸，里头却只有一只猫
//   ≥70 人形剪影   形状终于对了，颜色还没回来
//   ≥90 真容      她显形在那个一直空着的位置上
// 分档表是 narrator.js 的 AFFECTION_TIERS（唯一真值源），这里不另写一份边界。
const NARRATOR_BASE = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "portraits/narrator/";

export function narratorPortraitUrl(affection) {
  return NARRATOR_BASE + affectionTier(affection).portrait;
}

// 当前这一档立绘叫什么（UI 上标一行小字，让玩家知道自己看的是第几形态）。
export function narratorPortraitLabel(affection) {
  return affectionTier(affection).portraitLabel;
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
