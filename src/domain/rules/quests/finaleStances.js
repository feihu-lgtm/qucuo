// 终局「斗地主」八主立场（总纲 v3 终局 + 合稿各家「终局」节）。
// 拉拢只认各家最终任务写下的 flag；中立要么是最终任务的守中分支，要么是声誉 ≥15 解锁的说服中立任务；
// 没处理的势力按合稿各家写明的下场归位，合稿没写的按总纲：有被桑杰朵杰反向拉拢之险（鱼定村除外，只会沉默中立）。
export const FINALE_HOSTS = [
  { key: "yuding", faction: "鱼定村", ally: ["flag_endgame_ally_yuding"], neutral: [], enemy: [],
    unhandled: "neutral", unhandledNote: "紧闭家门，沉默中立" },
  { key: "yuquan", faction: "玉泉寨", ally: ["endgame_ally_yuquan", "endgame_ally_yuquan_full"], neutral: [], enemy: [],
    unhandled: "neutral", unhandledNote: "在土司骑手与血刀部过境的双重碾压下封寨失声" },
  { key: "heifeng", faction: "黑风寨", ally: ["endgame_buff_heifengzhai_raid_supply_lines"], neutral: [], enemy: [],
    unhandled: "neutral", unhandledNote: "终局前夜遭巡捕营夹击，无力出寨" },
  { key: "xueshan", faction: "雪山派", ally: ["xueshan_endgame_ally"], neutral: ["xueshan_endgame_lone", "finale_neutral_xueshan"], enemy: [],
    unhandled: "neutral", unhandledNote: "再度紧闭山门" },
  { key: "lama", faction: "喇嘛庙", ally: ["lama_endgame_ally"], neutral: ["finale_neutral_lama"], enemy: [],
    unhandled: "enemy", unhandledNote: "住持再次紧闭山门，土司府以「神佛默许」之名死战到底" },
  { key: "baihua", faction: "百花门", ally: ["finale_baihua_joined"], neutral: ["bh5_neutral", "finale_neutral_baihua"], enemy: [],
    unhandled: "enemy", unhandledNote: "接受土司府招安，以迷烟毒阵反噬" },
  { key: "huanxi", faction: "欢喜教", ally: ["ending_huanxi_luoqi_ally"], neutral: ["ending_huanxi_fanyanna", "finale_neutral_huanxi"], enemy: ["ending_huanxi_guanjia"],
    unhandled: "enemy", unhandledNote: "被桑杰朵杰反向拉拢" },
  { key: "jinguan", faction: "锦官城", ally: ["quest_guan2a_s1"], neutral: ["faction_jinguancheng_neutral"], enemy: [],
    unhandled: "enemy", unhandledNote: "被桑杰朵杰反向拉拢" },
];

export const STANCE_LABEL = { ally: "拉拢", neutral: "中立", enemy: "倒向土司" };

export const finaleHostFlags = (host) => [...host.ally, ...host.neutral, ...host.enemy];

export function resolveFinaleStances(flags = []) {
  const has = (list) => list.some((f) => flags.includes(f));
  return FINALE_HOSTS.map((host) => {
    if (has(host.enemy)) return { key: host.key, faction: host.faction, stance: "enemy", handled: true };
    if (has(host.ally)) return { key: host.key, faction: host.faction, stance: "ally", handled: true };
    if (has(host.neutral)) return { key: host.key, faction: host.faction, stance: "neutral", handled: true };
    return { key: host.key, faction: host.faction, stance: host.unhandled, handled: false, note: host.unhandledNote };
  });
}

export const finaleStanceFlag = ({ key, stance }) => `finale_stance_${key}_${stance}`;
