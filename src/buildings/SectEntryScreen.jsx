import React from "react";
import { Overlay, Header, Btn } from "./InnScreen.jsx";
import { SECT_ENTRY, checkSectEntry } from "../sectEntry.js";

// 拜师堂——雪山派入门。挂在内堂（何雨谢坐镇处）。
// 结算全在系统这边做完（扣束脩、发令牌、写身份 flag），AI 只负责把这件既成事实
// 写成一段像样的叙事，与送礼/拜师学艺同一套"结算+act陈述"范式。
export default function SectEntryScreen({ building, char, narratorAffection, flags, zoneTheme, onClose, inline, onJoinSect }) {
  const status = checkSectEntry({
    affection: narratorAffection,
    neigong: char.neigong ?? 0,
    money: char.money ?? 0,
    flags,
  });

  return (
    <Overlay onClose={onClose} zoneTheme={zoneTheme} inline={inline}>
      <Header name={building?.name || "拜师堂"} zoneTheme={zoneTheme} onClose={onClose} />
      <div style={{ padding: "14px 16px", fontSize: 12.5, lineHeight: 1.9, color: zoneTheme.text }}>

        {status.already ? (
          <>
            <div style={{ color: "#c07050", marginBottom: 10 }}>
              你已是{SECT_ENTRY.sect}门下弟子。
            </div>
            <div style={{ color: zoneTheme.textDim, fontSize: 11.5 }}>
              内堂之后的弟子别院已对你开放。令牌随身收好，那也是别院的钥匙。
            </div>
          </>
        ) : (
          <>
            <div style={{ color: zoneTheme.textDim, marginBottom: 12 }}>
              {SECT_ENTRY.master}坐在堂上，手里捧着一盏早凉了的茶。掌门不在山上，
              这些年门里大小事都是她在撑。她抬眼看你——收不收徒，她说了算。
            </div>

            <div style={{
              border: `1px solid ${zoneTheme.border}`, borderRadius: 0,
              padding: "10px 12px", marginBottom: 12, background: "rgba(255,255,255,.02)",
            }}>
              <div style={{ color: zoneTheme.accentDim, fontSize: 11, marginBottom: 6 }}>入门之限</div>
              {status.reqs.map(r => (
                <div key={r.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                  <span style={{ color: r.ok ? "#c07050" : "#c47070", width: 12 }}>{r.ok ? "✓" : "✗"}</span>
                  <span style={{ flex: 1, color: r.ok ? zoneTheme.text : zoneTheme.textDim }}>{r.label}</span>
                  <span style={{ color: r.ok ? "#c07050" : "#c47070", fontSize: 11 }}>{r.have}</span>
                </div>
              ))}
            </div>

            {status.eligible ? (
              <Btn label={`奉上束脩，拜入${SECT_ENTRY.sect}（-${SECT_ENTRY.tuition}两）`}
                onClick={onJoinSect} zoneTheme={zoneTheme} />
            ) : (
              <>
                <Btn label="尚不够格" disabled zoneTheme={zoneTheme} />
                <div style={{ color: zoneTheme.textDim, fontSize: 11, marginTop: 8 }}>
                  {status.missing.includes("affection") && <div>· 她还不够信你。多来往走动，让她看见你是什么样的人。</div>}
                  {status.missing.includes("neigong") && <div>· 底子还太薄。打坐运功，把内功练上去再来。</div>}
                  {status.missing.includes("tuition") && <div>· 束脩还差着。银两凑够了再来不迟。</div>}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Overlay>
  );
}
