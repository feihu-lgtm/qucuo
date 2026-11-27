// 生成 docs/夜色精修_界面原型.html：主屏明暗两线的可交互原型、色板与图标册。
// 图标取自 src/ui/primitives/iconPaths.js，和游戏里的 Icon 原语同源，改图标后跑 `npm run design:prototype`。
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ICON_GROUPS, ICON_TONE, iconSvg } from "../../src/ui/primitives/iconPaths.js";

export const PROTOTYPE_PATH = "docs/夜色精修_界面原型.html";

const TONE_COLOR = { accent: "#c8323a", good: "#8fb57a", danger: "#e5675c", gold: "#cfa95a" };
const ic = (name, size = 17) => iconSvg(name, size);

const PALETTE = [
  ["夜", "#0c0b09", "整页、正文栏底色"], ["栏", "#13120f", "天地栏、侠客栏、弹层"], ["件", "#1b1915", "按钮、卡片、输入框"], ["起", "#24211b", "悬停、按下、进度槽"],
  ["正文", "#ece6d6", "正文与主要文字"], ["次要", "#b9b19e", "说明、简介"], ["标签", "#8c8573", "栏目名、时间戳"], ["批语", "#b9a68a", "暗线批语（楷体）"],
  ["朱红", "#c8323a", "主行动、当前所在、未读"], ["朱红字", "#e5675c", "扣减、警示"], ["金", "#cfa95a", "人名、银两、贵重物"], ["青绿", "#8fb57a", "增益、好感上升、任务"], ["藕荷", "#c99bb2", "旁白其人"],
];

function gallery() {
  return ICON_GROUPS.map(([group, names]) => `
<h3 class="g">${group}</h3>
<div class="icons">${names.map((n) => `<div class="tile"><span style="color:${TONE_COLOR[ICON_TONE[n]] || "#b9b19e"}">${iconSvg(n, 28)}</span><span>${n}</span></div>`).join("")}</div>`).join("");
}

function palette() {
  return `<div class="pal">${PALETTE.map(([n, hex, use]) => `<div class="sw"><span class="chip" style="background:${hex}"></span><b>${n}</b><code>${hex}</code><span>${use}</span></div>`).join("")}</div>`;
}

export function buildPrototype() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>天都·曲措 夜色精修 界面原型</title>
<!-- 本文件由 scripts/design/buildPrototype.mjs 生成，不要手改。 -->
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500&display=swap" rel="stylesheet">
<style>
body{margin:0;background:#070605;color:#ece6d6;font-family:'Noto Serif SC','Songti SC','STSong',serif}
.wrap{max-width:1480px;margin:0 auto;padding:24px 20px 60px}
h1{font-size:20px;font-weight:500;letter-spacing:4px;margin:0 0 6px}
.lead{color:#b9b19e;font-size:14px;margin:0 0 18px;line-height:1.8}
h2{font-size:15px;font-weight:500;letter-spacing:4px;color:#8c8573;margin:40px 0 14px}
h3.g{font-size:12px;letter-spacing:4px;color:#8c8573;font-weight:400;margin:18px 0 10px}
.icons{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px}
.tile{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 4px 10px;background:#1b1915;border:1px solid #2c2924;border-radius:2px;font-size:12px;color:#b9b19e}
.pal{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.sw{display:grid;grid-template-columns:40px 1fr;grid-template-rows:auto auto;column-gap:12px;align-items:center;font-size:13px}
.sw .chip{grid-row:span 3;width:40px;height:40px;border:1px solid #3a362e;border-radius:2px}
.sw code{color:#8c8573;font-size:12px}.sw span:last-child{color:#b9b19e;font-size:12px}
#vp{position:relative;overflow:hidden;border:1px solid #25231f}
#st{--bg:#0c0b09;--p:#13120f;--c:#1b1915;--l:#25231f;--l2:#3a362e;--t:#ece6d6;--t2:#b9b19e;--t3:#8c8573;--pi:#b9a68a;--red:#c8323a;--redt:#e5675c;--gold:#cfa95a;--jade:#8fb57a;width:1440px;height:860px;transform-origin:0 0;background:var(--bg);display:flex;flex-direction:column}
.kai{font-family:"LXGW WenKai","Kaiti SC","STKaiti","KaiTi","BiauKai",serif}
.lab{font-size:12px;letter-spacing:4px;color:var(--t3)}
.tab{font-size:14px;letter-spacing:2px;padding-bottom:11px;color:var(--t3)}.tab.on{color:var(--t);border-bottom:2px solid var(--red)}
.row{padding:9px 0;border-bottom:1px solid var(--l)}
.slot{display:flex;align-items:center;gap:12px;padding:9px 12px;background:var(--c);border:1px solid #2c2924;border-radius:2px}
.slot .ib{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid var(--l2);color:var(--t2)}
.slot.empty{background:none;border-style:dashed}.slot.empty .ib{border-style:dashed;color:var(--t3)}
.ink{display:inline}#st.play .ink{animation:ink .5s ease-out both}
#st.play .pi{animation:fadeL .3s ease-out both}
#pcol{transition:width .3s ease,opacity .3s ease}
@keyframes ink{0%{opacity:0;filter:blur(5px)}100%{opacity:1;filter:blur(0)}}
@keyframes fadeL{0%{opacity:0;transform:translateX(-6px)}100%{opacity:1;transform:none}}
@keyframes breathe{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes blink{50%{opacity:0}}
.seg button{all:unset;cursor:pointer;padding:5px 12px;letter-spacing:2px;color:#8c8573}.seg button.on{background:#24211b;color:#ece6d6}
.ctl{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}.ctl button{background:#1b1915;color:#ece6d6;border:1px solid #3a362e;border-radius:2px;padding:6px 14px;font-family:inherit;cursor:pointer}
@media (prefers-reduced-motion:reduce){#st *{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<div class="wrap">
<h1>天都·曲措　夜色精修　界面原型</h1>
<p class="lead">主屏分明暗两线：江湖栏左边是正文（明线，宋体），右边是批语栏（暗线，楷体），按回合对齐。右上角“合、略、详”切换批语档；“重播”看一次回合到达的动效。人物、物品与地点取自真实存档，批语数值为示例。设计规范见 docs/设计稿_夜色精修.md。</p>

<div id="vp"><div id="st">
<div style="height:50px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid var(--l);background:#0f0e0b">
<div style="display:flex;align-items:center;gap:16px"><span style="font-size:16px;font-weight:500;letter-spacing:6px">天都·曲措</span>
<svg width="24" height="24" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="10" fill="none" stroke="#3a362e"/><path d="M13 3 A10 10 0 0 1 23 13" fill="none" stroke="#cfa95a" stroke-width="2"/><circle cx="23" cy="13" r="2.2" fill="#cfa95a"/></svg>
<span style="font-size:13px;letter-spacing:2px;color:var(--t2)">第三日　<span style="color:var(--gold)">巳初</span>　第五十八回合</span><span style="font-size:12px;letter-spacing:2px;color:var(--t3)">节气近小雪</span></div>
<div style="display:flex;align-items:center;gap:2px;font-size:13px;letter-spacing:2px;color:var(--t2)">
<span style="padding:8px 10px">入册</span><span style="padding:8px 10px">图鉴</span><span style="padding:8px 10px">日志</span><span style="padding:8px 10px">存档</span><span style="padding:8px 10px">设置</span>
<span style="width:1px;height:16px;background:var(--l2);margin:0 8px"></span>
<span style="padding:6px;display:flex">${ic("夜间")}</span><span style="padding:6px;display:flex">${ic("音乐")}</span><span style="padding:6px;display:flex">${ic("教程")}</span><span style="padding:6px;display:flex">${ic("上报")}</span>
<span style="width:1px;height:16px;background:var(--l2);margin:0 8px"></span>
<span style="padding:6px;display:flex;position:relative">${ic("来信")}<span style="position:absolute;top:0;right:-4px;min-width:15px;height:15px;border-radius:8px;background:var(--red);color:#f6efe2;font-size:10px;line-height:15px;text-align:center;letter-spacing:0">2</span></span>
<span style="width:1px;height:16px;background:var(--l2);margin:0 8px"></span>
<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--t3)"><span style="width:6px;height:6px;border-radius:3px;background:var(--jade)"></span>已保存</span>
<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--t3);margin-left:12px"><span style="width:6px;height:6px;border-radius:3px;background:var(--gold);animation:breathe 1.6s ease-in-out infinite"></span>推演中</span>
</div></div>

<div style="flex:1;display:flex;min-height:0">
<div style="width:310px;flex:none;background:var(--p);border-right:1px solid var(--l);display:flex;flex-direction:column">
<div style="height:50px;flex:none;display:flex;align-items:flex-end;gap:24px;padding:0 22px;border-bottom:1px solid var(--l)"><span class="lab" style="padding-bottom:13px">天地</span><span class="tab">此地</span><span class="tab on">周遭</span></div>
<div style="padding:18px 22px;display:flex;flex-direction:column;gap:18px">
<div><div class="lab" style="margin-bottom:8px">此地建筑</div><span style="display:inline-block;padding:5px 12px;background:var(--c);border:1px solid #2c2924;font-size:13px">驿站</span></div>
<div><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px"><span class="lab">此地　在场三人</span><span style="font-size:12px;color:var(--t3);letter-spacing:1px">契　信 <span style="color:var(--redt)">2</span>　信鸽 7</span></div>
<div class="row"><div style="display:flex;justify-content:space-between"><span style="font-size:14px;color:var(--gold);letter-spacing:1px">杨满仓</span><span style="font-size:12px;color:var(--t3)">尚未认识</span></div><div style="font-size:12px;color:var(--t2);margin-top:3px">无门无派的流民</div></div>
<div class="row"><div style="display:flex;justify-content:space-between"><span style="font-size:14px;color:var(--gold);letter-spacing:1px">雪豹</span><span style="font-size:12px;color:var(--jade)">亲近　86</span></div><div style="font-size:12px;color:var(--t2);margin-top:3px">长卧村口青石的雪白灵兽，前爪有旧伤</div></div>
<div class="row"><div style="display:flex;justify-content:space-between"><span style="font-size:14px;color:var(--gold);letter-spacing:1px">珍珠</span><span id="zzAff" style="font-size:12px;color:var(--jade)">熟络　36</span></div><div style="font-size:12px;color:var(--t2);margin-top:3px">村口通体雪白的小白马，爱低头啃草</div></div>
<div style="padding:9px 0;font-size:12px;color:var(--t2)">路人　晒青稞的女人</div></div>
<div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="lab">在附近（本据点别处）</span><span style="font-size:12px;color:var(--t3)">二十一人</span></div>
<div style="display:flex;flex-direction:column;gap:7px;font-size:12px"><div><span style="color:var(--t2)">老猎户</span>　<span style="color:var(--t3)">熟悉熊山地形</span></div><div><span style="color:var(--t2)">杂货商人</span>　<span style="color:var(--t3)">支着摊子卖些杂货</span></div><div><span style="color:var(--t2)">鱼定大娘</span>　<span style="color:var(--t3)">村里的老婆婆</span></div><div><span style="color:var(--t2)">周铭章</span>　<span style="color:var(--t3)">鱼定商号大掌柜</span></div><div style="color:var(--t3)">另有十七人</div></div></div>
</div></div>

<div style="flex:1;min-width:0;display:flex;flex-direction:column">
<div style="height:50px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 24px;border-bottom:1px solid var(--l)">
<span class="lab">江湖</span><div style="display:flex;align-items:center;gap:14px"><span style="color:var(--t3);display:flex">${ic("回滚")}</span><div id="seg" class="seg" style="display:flex;border:1px solid var(--l2);border-radius:2px;overflow:hidden;font-size:13px"></div></div></div>
<div style="flex:1;min-height:0;display:flex;overflow:hidden">
<div style="flex:1;min-width:0;padding:22px 30px 10px;display:flex;justify-content:center;overflow:hidden">
<div style="width:100%;max-width:600px;display:flex;flex-direction:column;gap:14px">
<div style="display:flex;align-items:center;gap:12px;font-size:12px;letter-spacing:2px;color:var(--t3)"><span>第三日　辰正　第五十七回合</span><span style="flex:1;height:1px;background:var(--l)"></span></div>
<div style="font-size:14px;color:var(--t2);letter-spacing:1px"><span style="color:var(--t3)">你　</span>把半袋青稞再抓一把给珍珠，这是第四十四次试。</div>
<div style="font-size:16px;line-height:1.95">
<p style="margin:0 0 12px;text-indent:2em"><span class="ink" style="animation-delay:.2s">你直起靠在夯土墙上的身子，伸手探进腰间的粗布行囊里摸索，只摸到扎紧的干硬袋口。</span><span class="ink" style="animation-delay:.7s">你将那只糙麻布口袋掏出来，指尖拨开麻绳往里一拢，才发觉先前洒落的青稞早已所剩无几。</span></p>
<p style="margin:0 0 12px;text-indent:2em"><span class="ink" style="animation-delay:1.2s">正蹲在车棚阴凉地里歇脚的<span style="color:var(--gold)">珍珠</span>闻见布囊响动，懒洋洋抬起那张俊俏白净的脸，鼻尖朝你空空的掌心嗅了嗅，</span><span class="ink" style="animation-delay:1.7s">喉咙里呼出一声极其散漫的叹息。</span></p>
<p style="margin:0;text-indent:2em"><span class="ink" style="animation-delay:2.1s">一旁的<span style="color:var(--gold)">雪豹</span>淡蓝灰色的竖瞳掠过你空荡的手心，低低道了一句：</span><span class="ink" style="animation-delay:2.5s">“没有了。”</span></p></div>
<div style="font-size:12px;color:var(--t3);letter-spacing:1px">接口中断，已自动重试两次</div>
<div style="display:flex;align-items:center;gap:12px;font-size:12px;letter-spacing:2px;color:var(--t3);margin-top:8px"><span>第三日　巳初　第五十八回合</span><span style="flex:1;height:1px;background:var(--l)"></span></div>
<div style="font-size:14px;color:var(--t2);letter-spacing:1px"><span style="color:var(--t3)">你　</span>把铜铃举起来摇三下，看有没有谁回头。</div>
<div style="font-size:12px;color:var(--t3);display:flex;align-items:center;gap:6px">叙事生成中<span style="width:1px;height:14px;background:var(--t);animation:blink 1s step-end infinite"></span></div>
</div></div>
<div id="pcol" style="width:260px;flex:none;border-left:1px solid var(--l);overflow:hidden"><div class="kai" style="width:260px;padding:22px 18px;box-sizing:border-box">
<div id="plist" style="display:flex;flex-direction:column;gap:9px;font-size:13.5px;line-height:1.7;color:var(--pi)"></div>
<div style="margin-top:200px;font-size:13px;color:var(--t3);animation:breathe 1.6s ease-in-out infinite">推演中</div></div></div>
</div>
<div style="flex:none;border-top:1px solid var(--l);background:#0f0e0b;padding:12px 30px 16px;display:flex;justify-content:center"><div style="width:100%;max-width:860px;display:flex;gap:8px">
<div style="flex:1;height:46px;display:flex;align-items:center;gap:10px;padding:0 16px;background:var(--c);border:1px solid var(--l2);border-radius:2px;font-size:14px;color:var(--t3)"><span style="color:var(--t2)">@</span>说话做事直接写，敲 @ 或 // 可私聊旁白与指定对象</div>
<div style="height:46px;padding:0 24px;display:flex;align-items:center;background:var(--red);border-radius:2px;color:#f6efe2;font-size:15px;letter-spacing:4px">发送</div></div></div>
</div>

<div style="width:330px;flex:none;background:var(--p);border-left:1px solid var(--l);display:flex;flex-direction:column">
<div style="height:50px;flex:none;display:flex;align-items:flex-end;gap:18px;padding:0 20px;border-bottom:1px solid var(--l)"><span class="lab" style="padding-bottom:13px">侠客</span><span class="tab">人物</span><span class="tab">任务</span><span class="tab">武学</span><span class="tab on">行囊</span><span class="tab">羁绊</span><span class="tab">江湖</span></div>
<div style="padding:18px 20px;display:flex;flex-direction:column;gap:20px">
<div style="display:flex;flex-direction:column;gap:8px"><div class="lab">披挂</div>
<div class="slot"><span class="ib">${ic("招式")}</span><div><div style="font-size:14px">鱼定枪</div><div style="font-size:11px;color:var(--t3);margin-top:2px">兵器　<span style="color:#d8d2c4">白</span>　攻六</div></div></div>
<div class="slot empty"><span class="ib">${ic("防御")}</span><div style="font-size:13px;color:var(--t3)">护甲　空着</div></div>
<div class="slot"><span class="ib">${ic("饰品")}</span><div><div style="font-size:14px">赌石邀帖</div><div style="font-size:11px;color:var(--t3);margin-top:2px">饰品　<span style="color:#d8d2c4">白</span></div></div></div></div>
<div><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span class="lab">包袱</span><span style="font-size:12px;color:var(--t3);letter-spacing:1px">四件　点名看介绍</span></div>
<div class="row" style="display:flex;justify-content:space-between;font-size:14px"><span>赌石邀帖 <span style="font-size:11px;color:var(--t3)">已披挂</span></span><span style="font-size:12px;color:var(--t3)">卸</span></div>
<div class="row" style="font-size:14px">半袋青稞</div>
<div class="row" style="display:flex;justify-content:space-between;font-size:14px"><span>鱼定枪 <span style="font-size:11px;color:var(--t3)">已披挂</span></span><span style="font-size:12px;color:var(--t3)">卸</span></div>
<div style="padding:9px 0;font-size:14px">溪边小屋钥匙</div></div>
</div></div>
</div></div></div>
<div class="ctl"><button type="button" id="rp">重播</button></div>

<h2>色板</h2>
${palette()}

<h2>线描图标（与 Icon 原语同源）</h2>
${gallery()}
</div>
<script>
var st=document.getElementById('st'),vp=document.getElementById('vp'),pcol=document.getElementById('pcol'),plist=document.getElementById('plist'),seg=document.getElementById('seg'),zz=document.getElementById('zzAff');
var LUE=[['好感','珍珠　熟络　36 → <b class="n">34</b>　<span style="color:#e5675c">−2</span>'],['心账','珍珠记下一笔「见」：少侠两手空空又来讨好'],['起居','今日第三次喂食，开局以来第四十四次']];
var XIANG=LUE.concat([['旧账','珍珠新添一句：手里总是空的'],['听意','喂食　对象珍珠　结果落空'],['定案','因果档 T0　篇幅约 320 字　签发一条：珍珠好感 −2'],['授信','品阶上限白　词条点数 0　今日搜刮余量 2'],['体感','气血尚算充盈，步履轻快；辰时，节气近小雪'],['活人','珍珠　熟络　正在车棚阴凉里歇脚'],['活人','雪豹　亲近　立在一旁']]);
var mode='略';
function fit(){var s=Math.min(1,vp.clientWidth/1440);st.style.transform='scale('+s+')';vp.style.height=Math.round(860*s)+'px';}
function renderSeg(){seg.innerHTML='';['合','略','详'].forEach(function(m){var b=document.createElement('button');b.type='button';b.textContent=m;if(m===mode)b.className='on';b.onclick=function(){mode=m;renderSeg();renderP(true);};seg.appendChild(b);});}
function renderP(anim){var list=mode==='详'?XIANG:mode==='略'?LUE:[];pcol.style.width=mode==='合'?'0px':'260px';pcol.style.opacity=mode==='合'?'0':'1';
plist.innerHTML=list.map(function(r,i){var sep=(r[0]==='听意')?'margin-top:6px;padding-top:8px;border-top:1px solid #25231f;':'';return '<div class="pi" style="'+sep+'animation-delay:'+((anim?0:3.0)+i*0.12)+'s"><span style="color:#8c8573;margin-right:8px">'+r[0]+'</span>'+r[1]+'</div>';}).join('');}
function roll(){var el=plist.querySelector('.n');zz.textContent='熟络　36';if(!el)return;var t0=null;function step(t){if(!t0)t0=t;var p=Math.min(1,Math.max(0,(t-t0-3000)/400));el.textContent=Math.round(36-2*p);if(p>=1)zz.textContent='熟络　34';if(p<1)requestAnimationFrame(step);}requestAnimationFrame(step);}
function play(){st.classList.remove('play');void st.offsetWidth;renderP(false);st.classList.add('play');roll();}
fit();window.addEventListener('resize',fit);renderSeg();play();document.getElementById('rp').onclick=play;
</script>
</body>
</html>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(PROTOTYPE_PATH, buildPrototype());
  console.log(`wrote ${PROTOTYPE_PATH}`);
}
