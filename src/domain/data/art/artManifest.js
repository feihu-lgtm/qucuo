// 美术素材登记表：游戏按字段查图，查到的才显示，查不到就只显示文字。
// 文件放在 public/art/<类>/<文件名>.webp（600×300，2:1，webp 质量 82），这里只登记「谁有图、文件叫什么」。
// 新图入库：把切好的 webp 放进对应目录，再在下面登记一行；scripts/art/artManifest.test.js 会核对
// 登记的名字在游戏数据里真实存在、登记的文件确实在目录里。
//
// 键的口径与 scripts/art/artPrompts.mjs 的格子 keys 一致：
//   PLACE_ART       外层据点名（QUCUO_MAP 的键）→ 文件名
//   BUILDING_ART    建筑类型（BUILDING_TYPE 的值）→ 文件名
//   BUILDING_ID_ART 个别建筑专图（建筑 id）→ 文件名，优先于类型图；给后山温泉、令狐冲墓这类
//                   用通用类型图会画错的地方单独配图
//   HOME_ART        家园设施 id（HOMESTEAD_FEATURES 里的 id）→ 文件名
//   MAP_ART         舆图底卷（M01）文件名，放 public/art/map/；没有就为 null，大地图只用代码画

export const PLACE_ART = Object.freeze({
  "鱼定村": "L01",
  "鱼定土司": "L02",
  "喇嘛庙": "L03",
  "白塔": "L04",
  "后山平台": "L05",
  "雪山派": "L06",
  "山洞": "L07",
  "顶峰": "L08",
  "天都镇": "L09",
  "大草甸": "L10",
  "玉泉寨": "L11",
  "黑风寨": "L12",
  "贡措海": "L13",
  "雅江": "L14",
  "广汉": "L15",
  "锦官城": "L16",
  "天龙营": "L17",
  "雾隐寨": "L18",
  "蜀南唐堡": "L19",
  "心灵之海": "L20",
  "第三新东京市": "L21",
});

export const BUILDING_ART = Object.freeze({});

export const BUILDING_ID_ART = Object.freeze({});

export const HOME_ART = Object.freeze({});

export const MAP_ART = null;
