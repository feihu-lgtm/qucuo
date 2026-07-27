// 开场图文序列
// 仅在"全新开局"（没有存档、第一次点开始）时展示一次：
// 第一张——少年策马入村，远眺三曲交汇的鱼定村
// 第二张——邀帖特写，隶书"<玩家名> 启"，落款一个"温"字
// 点击画面或按任意键推进到下一张，第二张点击后关闭序列，正式进入游戏
//
// 身世设定：主角就是无名之人，没有失落的血脉也没有隐藏的仇家（见 narrator.js
// 的 WHISPER_TOPICS.origin）。手上那张帖子不是身世信物，只是温掌柜的赌石邀帖，
// 纯粹作为"你为什么会来曲措乡"的触发器。改这里的文案时别把两件事又缠回一起。
import React, { useState } from "react";
import { ZONE_THEMES } from "./theme.js";

const theme = ZONE_THEMES.village;
// 沿用 GambleStoneScreen 的资源路径写法（走 Vite BASE_URL，部署到子路径也不断）
const SCROLL_H = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "stones/ui/scroll_h.webp";

export default function OpeningSequence({ onFinish, playerName }) {
  const [index, setIndex] = useState(0);
  const [imgErr, setImgErr] = useState({});
  const name = playerName || "无名少侠";
  const SLIDES = [
    {
      image: "/intro-1.webp",
      caption: "你揣着一张赌石邀帖，一路翻山越岭走到这曲措乡地界。没有姓氏可报，没有师门可攀。",
    },
    {
      image: "/intro-2.webp",
      caption: `帖上写着：${name} 启。落款一个「温」字——天都镇玉器轩，三日一开石，路远，来不来随意。`,
    },
  ];
  const slide = SLIDES[index];

  const advance = () => {
    if (index < SLIDES.length - 1) {
      setIndex(index + 1);
    } else {
      onFinish();
    }
  };

  return (
    <div style={styles.container} onClick={advance}>
      {/* 缺图兜底：public/intro-1.webp 与 intro-2.webp 由作者自行投放（提示词见
          docs/开场图提示词.md）。没投放时不显示破图图标——降级成一层渐变底，
          文案照样读得清，开场流程不受影响。此前是裸 <img> 无 onError，
          而这两个文件仓库里从来没有过，等于开场必然显示两次破图。 */}
      {!imgErr[index] ? (
        <img src={slide.image} alt="" style={styles.image}
          onError={() => setImgErr(e => ({ ...e, [index]: true }))} />
      ) : (
        <div style={styles.imageFallback} />
      )}
      <div style={styles.vignette} />
      {/* 文案落在横卷轴上（public/stones/ui/scroll_h.webp，赌石那套精美UI里的资源）。
          此前是裸文字压在 vignette 上——图一换成实拍质感的插画，白字直接飘在画面上
          就显得很轻，像调试期的占位。卷轴既给了文字一个落脚的实体，也跟武侠开场
          的调子对得上。
          用法沿用 GambleStoneScreen 的既有约定：backgroundSize "100% 100%" 拉伸铺满
          （不做九宫格切片——那批图本就是整幅设计好的，拉伸幅度不大时观感没问题）。
          左右留出 12% 内边距把文字压在纸面上、不压到两端木轴。 */}
      <div style={styles.scrollWrap}>
        <div style={styles.scrollPanel}>
          <p style={styles.captionText}>{slide.caption}</p>
          <div style={styles.hint(theme)}>
            {index < SLIDES.length - 1 ? "点击继续 ▸" : "点击进入曲措乡"}
          </div>
        </div>
      </div>
      <div style={styles.dots}>
        {SLIDES.map((_, i) => (
          <span key={i} style={styles.dot(theme, i === index)} />
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    inset: 0,
    backgroundColor: "#000",
    cursor: "pointer",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  imageFallback: {
    width: "100%", height: "100%", display: "block",
    background: "radial-gradient(ellipse at 50% 35%, #2a3340 0%, #141820 55%, #0a0c10 100%)",
  },
  vignette: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 40%, rgba(0,0,0,0.75) 100%)",
    pointerEvents: "none",
  },
  // 卷轴外层：定位与尺寸。宽度比原来的 560 放宽一点——卷轴两端木轴要占掉一部分，
  // 纸面可用宽度才够放两行字。
  scrollWrap: {
    position: "absolute",
    bottom: "40px",
    left: "50%",
    transform: "translateX(-50%)",
    // 三道约束取最小：桌面上限 680、窄屏让 92vw、**横屏再让 68vh**。
    // 【为什么要第三道】aspectRatio 是宽度驱动高度的：横屏手机（如 800×400）
    // 若只有前两道，宽取 680 → 高 261px ≈ 屏高 65%，卷轴会糊住整个下半屏。
    // 68vh 的宽度上限按 2.6 比例折算过去，高度就被压在 26vh 左右。
    width: "min(680px, 92vw, 68vh)",
    // 比例贴着 scroll_h 原图（482×220 ≈ 2.19），略压扁一点让它别太占画面
    aspectRatio: "2.6 / 1",
    backgroundImage: `url(${SCROLL_H})`,
    backgroundSize: "100% 100%",
    backgroundRepeat: "no-repeat",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    filter: "drop-shadow(0 10px 26px rgba(0,0,0,.55))",
  },
  // 内层：把文字压在纸面上。左右 12% 避开两端木轴，上下留一点让字不贴纸边。
  scrollPanel: {
    width: "76%",
    padding: "0 2%",
    textAlign: "center",
  },
  captionText: {
    fontFamily: "'Noto Serif SC', 'Songti SC', serif",
    fontSize: "clamp(13px, 1.9vh, 17px)",
    lineHeight: 1.85,
    // 纸面上要墨色，不能再用原来那个浅米白——那是给"压在画面上"设计的
    color: "#3a2a16",
    // 原来是给"白字压深色画面"设计的重阴影；落到纸面上就是一团脏。
    // 换成极淡的暖影，只为让墨色离纸面一点点。
    textShadow: "0 1px 0 rgba(255,248,230,.6)",
    marginBottom: "14px",
  },
  hint: (t) => ({
    fontSize: "clamp(9px, 1.3vh, 11px)",
    letterSpacing: "3px",
    marginTop: "0.6vh",
    // 不再用主题 accent——那个色是为深色面板挑的，落在纸面上几乎看不见。
    color: "#8a6a3a",
    opacity: 0.95,
  }),
  dots: {
    position: "absolute",
    top: "24px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: "6px",
  },
  dot: (t, active) => ({
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: active ? t.accent : "rgba(255,255,255,0.3)",
    transition: "background-color 0.3s ease",
  }),
};
