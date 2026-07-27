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
      <div style={styles.captionBox(theme)}>
        <p style={styles.captionText}>{slide.caption}</p>
        <div style={styles.hint(theme)}>
          {index < SLIDES.length - 1 ? "点击继续 ▸" : "点击进入曲措乡"}
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
  captionBox: (t) => ({
    position: "absolute",
    bottom: "48px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(560px, 86vw)",
    textAlign: "center",
  }),
  captionText: {
    fontFamily: "'Noto Serif SC', 'Songti SC', serif",
    fontSize: "16px",
    lineHeight: 1.9,
    color: "#ece3d0",
    textShadow: "0 2px 8px rgba(0,0,0,0.8)",
    marginBottom: "14px",
  },
  hint: (t) => ({
    fontSize: "11px",
    letterSpacing: "3px",
    color: t.accent,
    opacity: 0.85,
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
