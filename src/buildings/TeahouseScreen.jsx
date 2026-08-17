import React from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";

// 茶馆：花少量银两听掌柜说话，注入随机传闻
const RUMORS = [
  "听说锦官城最近来了个神秘的外乡剑客，据说跟雪山派有什么渊源。",
  "最近大草甸那边有狼群出没，猎户们都绕路走了。",
  "玉泉寨有个老牧民说，贡措海底下藏着前朝的宝藏，但也只是传说。",
  "喇嘛庙最近不太平，听说藏经阁少了几卷重要的经书，老和尚急得不行。",
  "鱼定土司在和锦官城的某个官员谈买卖，说是土地的事。",
  "天都镇最近多了几个陌生人，打扮像是镖师，但问起来谁也不知道跑哪个镖。",
  "后山有人目击到奇异的亮光，有人说是妖，有人说是雪山派在试法术。",
  "大路马那伙人最近行事更猖獗了，官府的缉拿队已经去了三回了。",
  "最近有商队说路上遭了劫，但奇怪的是，货没少，就像是被人搜了一遍。",
  "雪山派说最近开始收外门弟子，但要通过一关比试才行。",
];

export default function TeahouseScreen({ building, char, flags, time, zoneTheme, onClose, inline, onListenRumor }) {
  const money = char.money || 0;
  const COST = 5;

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building.name} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#8f8a7c", fontSize: 11, marginBottom: 12 }}>
          {building.desc}
        </div>
        <div style={{ color: "#8f8a7c", marginBottom: 14, fontSize: 11 }}>
          银两 {money} 两 · 每次听消息花 {COST} 两
        </div>
        <Btn
          label={`听掌柜说几句（${COST}两）`}
          disabled={money < COST}
          zoneTheme={zoneTheme}
          onClick={() => {
            const idx = Math.floor(Math.random() * RUMORS.length);
            onListenRumor(RUMORS[idx], COST);
          }}
        />
        <div style={{ color: "#4a4a4a", fontSize: 10, marginTop: 12 }}>
          江湖消息真假参半，听个热闹，说不定能有用。
        </div>
      </div>
    </Overlay>
  );
}
