// 武学目录聚合：每势力一个文件，键值即 qucuoBuildings.js 的 skillSet 键。
import { yuquan } from "./yuquan.js";
import { xueshan } from "./xueshan.js";
import { jinguan } from "./jinguan.js";
import { dugu } from "./dugu.js";
import { qingcheng } from "./qingcheng.js";
import { emei } from "./emei.js";
import { tangmen } from "./tangmen.js";
import { lamamiao } from "./lamamiao.js";
import { wuxian } from "./wuxian.js";
import { yuding } from "./yuding.js";
import { gaibang } from "./gaibang.js";
import { huanxi } from "./huanxi.js";
import { heifeng } from "./heifeng.js";
import { tusi } from "./tusi.js";
import { xuedao } from "./xuedao.js";
import { tianlong } from "./tianlong.js";
import { sanxing } from "./sanxing.js";
import { baihua } from "./baihua.js";

export const SKILL_CATALOG = {
  玉泉: yuquan,
  雪山: xueshan,
  锦官: jinguan,
  独孤: dugu,
  青城: qingcheng,
  峨眉: emei,
  唐门: tangmen,
  喇嘛庙: lamamiao,
  五仙: wuxian,
  鱼定: yuding,
  丐帮: gaibang,
  欢喜: huanxi,
  黑风: heifeng,
  土司: tusi,
  血刀: xuedao,
  天龙: tianlong,
  三星: sanxing,
  百花: baihua,
};
