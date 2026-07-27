import React from "react";
import { QUALITY_COLOR, CATEGORY_LABEL } from "./equipment.js";

// 切磋掉落 / 偷窃成功 / 偷师得手 三种"所得卡"——像素藏地武侠风，复用同一套
// 卡框与排版。底图 loot_duel.png（暖金·交叉双刀+金刚杵+莲花+余烬）/
// loot_steal.png（冷翠·窃贼面具+探出之手+月+云纹）由作者投放于
// public/stones/ui/，1122×1402（4:5）。偷窃与偷师共用冷翠底图（同属"顺手/窥得"
// 的月黑风高调性）。
//
// 【居中浮卡】卡片限宽 420、水平 margin auto，浮在左对齐的叙事流正中，像一枚
// 郑重托出的所得凭证，跟上下说书文本区分开——高光时刻该有这个仪式感。卡内
// banner/名号/词条/价目一律居中排，唯描述走居中楷体如"此物有判词为证"。
// 背板本身也在卡框里横竖双居中（panel 走 flex 居中，inset 收成对称值），
// 不顶卡框上沿——内容短短时稳稳悬在框心，长长时上下对称撑开。
// 底图当"完整卡框"：object-fit:fill 仅纵向随内容伸缩、水平不缩放，故左右装饰
// （含偷窃卡探入中心的那双手）水平像素位置恒定，与背板左右边永远对齐；内容浮
// 在中心一块"顶底羽化"的暗背板上，描述再长也不裁切、不滚动，撑高时背板顶底以
// 18px 透明渐变柔和过渡，不硬切边框。
//
// entry 结构（物品）：{ t:"loot", item, source:"duel"|"steal", fromNpc, text }
//   item 须为 makeGameItem 产出的完整对象（atk/def/effect/sixDim/desc/价格齐全）。
// entry 结构（技能）：{ t:"loot", skill:{name,quality,moveType}, desc, source:"steal", fromNpc }
//   偷师得手时发，无 item；展示招式名/品阶/类型/描述，不展示攻防与买卖价。

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
const UI = (f) => `${BASE}stones/ui/${f}`;

const EFF_CN = {
  forceFirst: "必先手", ignoreDefense: "透甲破防", doubleVsStatus: "克中招翻倍",
  lowHpBonus: "残血增伤", afterStatusBonus: "趁中招追击", detonateMark: "引爆内伤",
  enemyCostPenalty: "封穴耗气", freezeEnergyRecovery: "封气", applyMark: "附内伤印",
  onCounterSuccessDamageRatio: "应对反击", onCounterSuccessEnergyGain: "应对回气",
  hpRestore: "回血", energyRestore: "起手回气",
};

function effectLines(effect) {
  if (!effect || typeof effect !== "object") return [];
  const out = [];
  for (const k of Object.keys(effect)) {
    if (k === "applyMarkChance" || k === "applyMarkOnHit") continue;
    if (EFF_CN[k]) out.push(EFF_CN[k]);
  }
  return out;
}

const PLATE_CLIP = "polygon(0 6px,3px 6px,3px 3px,6px 3px,6px 0,calc(100% - 6px) 0,calc(100% - 6px) 3px,calc(100% - 3px) 3px,calc(100% - 3px) 6px,100% 6px,100% calc(100% - 6px),calc(100% - 3px) calc(100% - 6px),calc(100% - 3px) calc(100% - 3px),calc(100% - 6px) calc(100% - 3px),calc(100% - 6px) 100%,6px 100%,6px calc(100% - 3px),3px calc(100% - 3px),3px calc(100% - 6px),0 calc(100% - 6px))";

const LOOT_CSS = `
  .loot-card{ position:relative; max-width:420px; margin:16px auto 20px; animation:lootIn .55s cubic-bezier(.2,1.35,.4,1) both; }
  @keyframes lootIn{
    0%{ opacity:0; transform:translateY(18px) scale(.93); }
    62%{ opacity:1; transform:translateY(-3px) scale(1.014); }
    100%{ opacity:1; transform:translateY(0) scale(1); }
  }
  .loot-frame{ position:relative; filter:drop-shadow(0 9px 22px rgba(0,0,0,.6)); transition:transform .24s cubic-bezier(.2,.8,.3,1), filter .24s ease; }
  .loot-card:hover .loot-frame{ transform:translateY(-4px) scale(1.012); filter:drop-shadow(0 14px 30px rgba(0,0,0,.7)) brightness(1.06); }
  .loot-hi{ filter:drop-shadow(0 9px 22px rgba(0,0,0,.6)) drop-shadow(0 0 15px var(--qc-glow)); }
  .loot-card:hover .loot-hi{ filter:drop-shadow(0 14px 30px rgba(0,0,0,.7)) drop-shadow(0 0 22px var(--qc-glow)) brightness(1.07); }
  .loot-panel{ position:relative; overflow:visible; image-rendering:pixelated; display:flex; align-items:center; justify-content:center; }
  .loot-bg{ position:absolute; inset:0; width:100%; height:100%; object-fit:fill; z-index:0; image-rendering:pixelated; pointer-events:none; }
  .loot-body{ position:relative; z-index:2; clip-path:${PLATE_CLIP}; padding:15px 16px 14px;
    background:linear-gradient(to bottom, transparent 0, var(--plate) 18px, var(--plate) calc(100% - 18px), transparent 100%);
    box-shadow:0 5px 16px rgba(0,0,0,.4); text-shadow:0 1px 2px rgba(0,0,0,.85); }
  .loot-banner{ display:flex; align-items:center; justify-content:center; gap:8px; font-size:10.5px; letter-spacing:.18em;
    padding:3px 12px 3px 9px; margin:0 auto 12px; width:max-content; max-width:100%;
    clip-path:polygon(0 0,100% 0,calc(100% - 9px) 100%,0 100%); font-weight:700; text-shadow:0 1px 1px rgba(0,0,0,.4); }
  .loot-name{ font-family:"STKaiti","KaiTi","Noto Serif SC","Songti SC",serif; font-size:22px; font-weight:900;
    line-height:1.22; letter-spacing:.06em; text-shadow:0 2px 3px rgba(0,0,0,.7), 0 0 13px var(--qc-glow); }
  .loot-name.loot-shimmer{ background:linear-gradient(100deg, var(--qc) 18%, var(--qc-hi) 44%, var(--qc) 62%);
    background-size:220% 100%; -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent;
    animation:lootShimmer 2.8s linear infinite; filter:drop-shadow(0 2px 3px rgba(0,0,0,.7)); }
  @keyframes lootShimmer{ 0%{ background-position:120% 0; } 100%{ background-position:-120% 0; } }
  .loot-chip{ font-size:9.5px; font-weight:700; padding:2px 8px; letter-spacing:.12em; color:#fff;
    clip-path:polygon(4px 0,100% 0,calc(100% - 4px) 100%,0 100%); text-shadow:0 1px 1px rgba(0,0,0,.6); }
  .loot-rule{ height:2px; margin:10px auto; width:78%; background:linear-gradient(90deg, transparent 0, var(--qc) 50%, transparent 100%); opacity:.6; }
  .loot-stats{ display:flex; flex-wrap:wrap; justify-content:center; gap:5px 16px; font-size:11.5px; }
  .loot-stat b{ font-size:14.5px; font-weight:800; color:var(--qc-hi); margin-left:3px;
    font-family:"Courier New",ui-monospace,monospace; text-shadow:0 0 9px var(--qc-glow), 0 1px 2px rgba(0,0,0,.8); }
  .loot-eff{ display:flex; flex-wrap:wrap; justify-content:center; gap:5px; margin-top:9px; }
  .loot-eff-tag{ font-size:10px; padding:2px 8px; letter-spacing:.08em; border:1px solid var(--qc);
    color:var(--qc-hi); background:rgba(0,0,0,.34); clip-path:polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%); text-shadow:0 1px 1px rgba(0,0,0,.7); }
  .loot-desc{ margin-top:11px; padding:8px 11px; font-size:12px; line-height:1.92; color:#e2d6b4; text-align:center;
    font-family:"STKaiti","KaiTi","Noto Serif SC","Songti SC",serif; letter-spacing:.03em;
    background:rgba(0,0,0,.26); border-left:3px solid var(--qc); }
  .loot-foot{ display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:8px 14px; margin-top:11px; font-size:11px; color:#c2b288; }
  .loot-foot img{ width:13px; height:13px; vertical-align:-2px; image-rendering:pixelated; }
  .loot-named{ color:var(--qc-hi); letter-spacing:.14em; font-size:10px; font-weight:700; }
  .loot-spark{ position:absolute; width:4px; height:4px; background:var(--qc-hi); z-index:3; pointer-events:none;
    box-shadow:0 0 7px var(--qc-hi); animation:lootSpark 1.7s ease-in-out infinite; }
  @keyframes lootSpark{ 0%,100%{ opacity:0; transform:scale(.35); } 50%{ opacity:1; transform:scale(1); } }
`;

const HI_QUALITY = new Set(["紫", "橙", "红"]);

export default function LootCard({ entry }) {
  const isSkill = !!entry.skill;
  const item = entry.item || {};
  const source = entry.source === "steal" ? "steal" : "duel";
  const isDuel = source === "duel" && !isSkill;

  // 展示数据：技能卡读 entry.skill，物品卡读 item。
  const showName = isSkill ? entry.skill.name : (item.name || "無名之物");
  const q = isSkill ? (entry.skill.quality || "白") : (item.quality || "白");
  const showDesc = isSkill ? entry.desc : item.desc;
  const typeChip = isSkill
    ? `${entry.skill.moveType || "招式"}·招式`
    : (CATEGORY_LABEL[item.category] || "雜物");

  const qc = QUALITY_COLOR[q] || "#c8bfa0";
  const hi = HI_QUALITY.has(q);

  // 切磋=暖金绛红（刀口余烬），偷窃/偷师=冷翠墨青（月黑风高）。
  const T = isDuel
    ? { bg: "linear-gradient(160deg,#3a1c12 0%,#2a1210 45%,#1e0e0a 100%)",
        banner: "linear-gradient(90deg,#8a5a1a,#c4a040)", bannerText: "#2a1608",
        label: "戰利品", sub: entry.fromNpc ? `擊敗 ${entry.fromNpc} 所獲` : "切磋所得",
        img: "loot_duel.png", inset: "6% 12%", plate: "rgba(20,8,4,.66)" }
    : { bg: "linear-gradient(160deg,#10241f 0%,#0c1c18 45%,#081210 100%)",
        banner: "linear-gradient(90deg,#2a5a4a,#5dcaa5)", bannerText: "#06231c",
        label: isSkill ? "偷師得手" : "妙手空空",
        sub: entry.fromNpc ? (isSkill ? `窺得 ${entry.fromNpc} 的招式` : `自 ${entry.fromNpc} 處順來`) : (isSkill ? "窺得一式絕學" : "神不知鬼不覺"),
        img: "loot_steal.png", inset: "6% 19%", plate: "rgba(6,18,15,.66)" };

  const eff = isSkill ? [] : effectLines(item.effect);
  const six = isSkill ? [] : Object.entries(item.sixDim || {}).map(([k, v]) => `${k}+${v}`);
  const statBits = [];
  if (!isSkill) {
    if (item.atk != null) statBits.push(["攻擊", item.atk]);
    if (item.def != null) statBits.push(["防禦", item.def]);
    if (item.bonus != null) statBits.push(["加成", item.bonus]);
    if (item.durability != null) statBits.push(["耐久", item.durability]);
  }

  return (
    <div className="loot-card" style={{ "--qc": qc, "--qc-hi": lighten(qc), "--qc-glow": qc + "66", "--plate": T.plate }}>
      <style>{LOOT_CSS}</style>
      <div className={`loot-frame ${hi ? "loot-hi" : ""}`}>
        <div className="loot-panel" style={{ aspectRatio: "1122 / 1402", background: T.bg }}>
          <img className="loot-bg" src={UI(T.img)} alt="" onError={(e) => { e.target.style.display = "none"; }} />
          {hi && (
            <>
              <span className="loot-spark" style={{ top: "5%", right: "8%", animationDelay: "0s" }} />
              <span className="loot-spark" style={{ top: "9%", right: "3.5%", animationDelay: ".55s" }} />
              <span className="loot-spark" style={{ bottom: "6%", left: "7%", animationDelay: "1.05s" }} />
            </>
          )}
          <div className="loot-body" style={{ margin: T.inset }}>
            <div className="loot-banner" style={{ background: T.banner, color: T.bannerText }}>
              <span style={{ fontSize: 13 }}>{isDuel ? "⚔" : "🤫"}</span>
              <span>{T.label}</span>
              <span style={{ opacity: .78, letterSpacing: ".08em", fontWeight: 400 }}>· {T.sub}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              <span className={`loot-name ${hi ? "loot-shimmer" : ""}`} style={{ color: hi ? undefined : qc }}>{showName}</span>
              <span className="loot-chip" style={{ background: qc }}>{q}</span>
              <span className="loot-chip" style={{ background: "rgba(255,255,255,.15)", color: "#e2d6b4" }}>{typeChip}</span>
            </div>

            <div className="loot-rule" />

            {statBits.length > 0 && (
              <div className="loot-stats">
                {statBits.map(([k, v]) => (
                  <span className="loot-stat" key={k} style={{ color: "#b0a078" }}>{k}<b>{v}</b></span>
                ))}
              </div>
            )}

            {(eff.length > 0 || six.length > 0) && (
              <div className="loot-eff">
                {eff.map(e => <span className="loot-eff-tag" key={e}>✦ {e}</span>)}
                {six.map(s => <span className="loot-eff-tag" key={s}>◈ {s}</span>)}
              </div>
            )}

            {showDesc && <div className="loot-desc">{showDesc}</div>}

            <div className="loot-foot">
              {isSkill ? (
                <span style={{ color: "#9ad8c8", letterSpacing: ".06em" }}>🤫 偷師所得 · 學即完整，無需修煉</span>
              ) : (
                <>
                  <span><img src={UI("ingot.png")} alt="" /> 買 {item.buyPrice ?? "—"} 兩</span>
                  <span><img src={UI("coin.png")} alt="" /> 賣 {item.sellPrice ?? "—"} 兩</span>
                  {item.named && <span className="loot-named">✦ 具名之物</span>}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function lighten(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const f = (c) => Math.min(255, c + 72);
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}
