import { BUILDING_TYPE } from "../buildingType.js";

  // ── 贡措海（1 种，令狐冲墓） ──
export const gongcuohai = [
    {
      // 【原来是 TEMPLE·独孤九剑根本学不了】它挂着 skillSet:"独孤"，但 TEMPLE 类型
      // 渲染的是拜祭殿（求karma），压根不读 skillSet——描述里承诺的「外功≥80可参悟
      // 习得」从来没有落地过，两门独孤武学（独孤九剑/剑冢独坐）在全图无处可学。
      // 改成 WUGUAN 才走得到授业界面。它不卖钱，走"参悟"路径：price 0 + 门槛。
      id: "dugu_tomb", name: "令狐冲墓", type: BUILDING_TYPE.WUGUAN, skillSet: "独孤",
      desc: "华山令狐冲之墓。墓壁刻有独孤九剑剑诀，笔锋斩石三分。剑诀不授不卖，只看你自己看不看得懂——外功够了，站在壁前自然就懂了。",
    },
];
