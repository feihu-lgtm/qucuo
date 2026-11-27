import { bodyProfileFilled } from "../../../domain/rules/character/bodyProfile.js";
import { OVERLAY, openOverlay } from "../../../store/uiStore.js";
import { Icon } from "../../primitives/index.js";
import AnimatedNumber from "../../components/AnimatedNumber.jsx";

// 侠客资料：玩家头像与基础数值。随行伙伴只在「羁绊」面的队伍栏里列一次，这里不再重复放。
export default function ProfileModule({ char, exp, pot, playerAvatar, inspectItem, inspecting }) {
  const hpCur = char.hp?.[0] ?? 0;
  const hpMax = Math.max(1, char.hp?.[1] ?? 100);
  const hpPct = Math.min(100, Math.max(0, Math.round((hpCur / hpMax) * 100)));
  const bodyTotal = bodyProfileFilled(char.bodyProfile).total;
  return (
    <div className="profile-wrap">
      {/* 玩家一列：头像 + 体貌按钮（体貌在头像正下方） */}
      <div className="profile-portrait-col">
        <div
          onClick={() => openOverlay(OVERLAY.AVATAR_PICKER)}
          title="点击更换头像" className="profile-avatar-card"
        >
          {playerAvatar ? (
            <img src={playerAvatar} alt="" className="profile-avatar-img" />
          ) : (
            <span className="profile-avatar-empty">点击<br/>设置头像</span>
          )}
          <span className="profile-avatar-tag">换像</span>
        </div>
        <span
          onClick={() => openOverlay(OVERLAY.BODY)}
          title="体貌 · 身量体型与身体细节，动作描写和私聊都会照着写" className="profile-body-btn" data-on={Boolean(bodyTotal)}
        >
          <Icon name="体貌" size={12} /> 体貌{bodyTotal ? ` ${bodyTotal}` : ""}
        </span>
      </div>
      <div className="profile-info-col">
        <div className="profile-char-name">{char.name || "无名少侠"}</div>
        <div className="profile-char-sub">{char.gender || "男"}　少侠</div>
        <div className="profile-hp-block">
          <div className="profile-stat-line">
            <span className="profile-stat-label"><Icon name="气血" size={13} /> 气血</span>
            <span className={`profile-stat-num${hpCur <= 30 ? " is-low" : ""}`}><AnimatedNumber value={hpCur} />/{char.hp?.[1] ?? 100}</span>
          </div>
          <div className="night-bar"><div className="night-bar-fill night-bar-fill--accent" style={{ width: `${hpPct}%` }} /></div>
        </div>
        <div className="profile-stat-line">
          <span className="profile-stat-label"><Icon name="经验" size={13} /> 经验 <AnimatedNumber className="profile-val-num" value={exp} /></span>
          <span className="profile-stat-label"><Icon name="潜能" size={13} /> 潜能 <AnimatedNumber className="profile-val-num" value={pot} /></span>
        </div>
        <div className="profile-stat-line">
          <span className="profile-stat-label"><Icon name="银两" size={13} /> 银两 <AnimatedNumber className="profile-val-gold" value={char.money || 0} /> 两</span>
        </div>
        <div className="profile-stat-line">
          <span className="profile-stat-label"><Icon name="信鸽" size={13} /> 信鸽 <span className="profile-val-gold">{char.pigeons || 0}</span> 只</span>
          <span
            onClick={() => inspectItem("pigeon", "信鸽", `现有${char.pigeons || 0}只`, null, { worldLook: true })}
            title="查看：信鸽是什么、能做什么" className="profile-inspect-btn" data-on={Boolean(inspecting === "信鸽")}
          >查看{inspecting === "信鸽" ? "…" : ""}</span>
        </div>
      </div>
    </div>
  );
}
