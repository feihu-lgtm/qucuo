import { useEffect, useRef, useState } from "react";
import GroundItemStrip from "../components/GroundItemStrip.jsx";
import { chromeBtn } from "../theme.js";
import { isNpcVisibleInInnerRoom } from "../../domain/rules/map/innerMap.js";

const MODES = [
  ["action", "行动", "◈ 行动"],
  ["talk", "对话", "◎ 对话"],
  ["whisper", "私聊旁白", "◆ 私聊旁白"],
];

export default function CenterControlRows({
  isMobile, mobileColumn, zoneTheme, room, innerRoomName,
  handleCollectGround, setInteractMode, interactMode, activeTarget,
  setActiveTarget, setTalkTarget, setPigeonTarget, activeGroundItem, setActiveGroundItem,
  nsfwOn, setNsfwOn, meditate, justMeditated,
  initialOpenMenu = null, children,
}) {
  const [openMenu, setOpenMenu] = useState(initialOpenMenu);
  const rootRef = useRef(null);
  const visibleNpcs = (room?.npcs || []).filter(npc => isNpcVisibleInInnerRoom(room?.name, innerRoomName, npc));
  const groundItems = room?.items || [];
  const showPeople = interactMode !== "pigeon" && visibleNpcs.length > 0;
  const peopleDisabled = interactMode === "whisper";
  const selectedMode = MODES.find(([id]) => id === interactMode)?.[1] || "行动";

  useEffect(() => {
    setOpenMenu(null);
  }, [isMobile, mobileColumn]);

  useEffect(() => {
    if (!openMenu) return undefined;
    const closeOutside = event => {
      if (!rootRef.current?.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [openMenu]);

  const toggleMenu = menu => setOpenMenu(current => current === menu ? null : menu);
  const chooseMobileMode = mode => {
    setInteractMode(mode);
    setPigeonTarget(null);
  };
  const choosePerson = npc => {
    setActiveTarget(npc?.name || null);
    setTalkTarget(npc?.name || null);
  };
  const trigger = (id, label, { active = false, disabled = false } = {}) => (
    <button
      type="button"
      className="mobile-touch-target mobile-mode-control"
      data-control-trigger={id}
      aria-haspopup="menu"
      aria-expanded={openMenu === id}
      aria-controls={`center-control-menu-${id}`}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={disabled ? undefined : () => toggleMenu(id)}
      style={{ ...chromeBtn(zoneTheme, { active: active || openMenu === id }), fontFamily: "inherit", opacity: disabled ? 0.4 : 1 }}
    >{label} ▾</button>
  );
  const menuOption = (key, label, active, onSelect) => (
    <button
      key={key}
      type="button"
      role="menuitem"
      data-menu-option={key}
      aria-current={active ? "true" : undefined}
      onClick={() => { setOpenMenu(null); onSelect(); }}
      style={{
        ...chromeBtn(zoneTheme, { active }),
        width: "100%", height: 35, minHeight: 35, justifyContent: "flex-start",
        padding: "0 10px", fontFamily: "inherit", fontSize: "12px", flexShrink: 0,
      }}
    >{label}</button>
  );
  const groundItemOption = (item, index) => {
    const name = typeof item === "string" ? item : item?.name;
    const selected = activeGroundItem === name;
    return (
      <div key={item?.id || name || index} role="group" aria-label={name} style={{
        display: "flex", alignItems: "center", gap: 2, height: 35, minHeight: 35, flexShrink: 0,
      }}>
        <button
          type="button"
          role="menuitemradio"
          data-ground-select={name}
          aria-checked={selected}
          onClick={() => { setOpenMenu(null); setActiveGroundItem(current => current === name ? null : name); }}
          style={{
            ...chromeBtn(zoneTheme, { active: selected }),
            flex: 1, minWidth: 0, height: 35, minHeight: 35, justifyContent: "flex-start",
            padding: "0 10px", fontFamily: "inherit", fontSize: "12px",
          }}
        >{name}</button>
        <button
          type="button"
          role="menuitem"
          data-ground-pickup={name}
          aria-label={`拾取${name}`}
          onClick={() => {
            setOpenMenu(null);
            if (selected) setActiveGroundItem(null);
            handleCollectGround(item);
          }}
          style={{
            ...chromeBtn(zoneTheme, { active: false }),
            height: 35, minHeight: 35, padding: "0 8px", fontFamily: "inherit", fontSize: "11px",
          }}
        >拾取</button>
      </div>
    );
  };
  const menu = openMenu && (
    <div
      id={`center-control-menu-${openMenu}`}
      className="center-control-menu"
      role="menu"
      data-control-menu={openMenu}
      style={{
        position: "absolute", bottom: "100%", left: 0, zIndex: 30,
        display: "flex", flexDirection: "column", gap: 2, padding: 4,
        minWidth: 148, maxWidth: "calc(100vw - 28px)", maxHeight: "min(60vh, 315px)",
        overflowY: "auto", boxSizing: "border-box",
        background: zoneTheme.bgPanel, border: `1px solid ${zoneTheme.border}`, color: zoneTheme.text,
      }}
    >
      {openMenu === "mode" && MODES.map(([id, label, optionLabel]) =>
        menuOption(id, optionLabel, interactMode === id, () => chooseMobileMode(id)))}
      {openMenu === "people" && !peopleDisabled && showPeople && (
        <>
          {menuOption("all", "全部", !activeTarget, () => choosePerson(null))}
          {visibleNpcs.map(npc => menuOption(
            `npc-${npc.name}`, npc.name, activeTarget === npc.name, () => choosePerson(npc),
          ))}
        </>
      )}
      {openMenu === "ground" && menuOption("ground-none", "不选", !activeGroundItem, () => setActiveGroundItem(null))}
      {openMenu === "ground" && groundItems.map((item, index) =>
        groundItemOption(item, index))}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div
          ref={rootRef}
          className="center-control-row-anchor"
          style={{ position: "relative", zIndex: openMenu ? 20 : "auto", flexShrink: 0 }}
        >
          <div className="mobile-control-row" style={{
            borderTop: `1px solid ${zoneTheme.border}`, padding: "4px 14px", display: "flex",
            alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "nowrap",
          }}>
            {trigger("mode", selectedMode)}
            {showPeople && trigger("people", activeTarget || "全部", { disabled: peopleDisabled })}
            {groundItems.length > 0 && trigger("ground", activeGroundItem || `地上 ${groundItems.length}`)}
            <span style={{ flex: "1 1 auto", minWidth: 0 }} />
            <button
              type="button"
              className="mobile-touch-target mobile-mode-control"
              data-control-action="nsfw"
              aria-pressed={nsfwOn}
              onClick={() => { setOpenMenu(null); setNsfwOn(value => !value); }}
              style={{ ...chromeBtn(zoneTheme, { active: nsfwOn }), fontFamily: "inherit" }}
            >NSFW</button>
            <button
              type="button"
              className="mobile-touch-target mobile-mode-control"
              data-control-action="meditate"
              aria-pressed={justMeditated}
              onClick={() => { setOpenMenu(null); meditate(); }}
              style={{
                ...chromeBtn(zoneTheme, { active: justMeditated }),
                fontFamily: "inherit",
                transform: justMeditated ? "scale(0.95)" : "scale(1)",
                transition: "all 0.15s ease",
              }}
            >⊙ 打坐{justMeditated ? "…" : ""}</button>
          </div>
          {menu}
        </div>
        {children}
      </>
    );
  }

  return (
    <>
      <div className="mobile-control-row" style={{ borderTop: `1px solid ${zoneTheme.border}`, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
        {MODES.map(([id, , label]) => (
          <span
            key={id}
            className="mobile-touch-target mobile-mode-control"
            onClick={() => { setInteractMode(id); setTalkTarget(null); setActiveTarget(null); setPigeonTarget(null); }}
            style={chromeBtn(zoneTheme, { active: interactMode === id })}
          >{label}</span>
        ))}
        <span
          className="mobile-touch-target mobile-mode-control"
          onClick={() => setNsfwOn(value => !value)}
          title={nsfwOn ? "已开启：NSFW 写作规则已注入" : "已关闭：点击开启 NSFW 写作规则"}
          style={chromeBtn(zoneTheme, { active: nsfwOn })}
        >NSFW</span>
        <span style={{ flex: 1 }} />
        <span
          className="mobile-touch-target mobile-mode-control"
          onClick={meditate}
          title="打坐运功：消耗1回合，恢复部分气血"
          style={{
            ...chromeBtn(zoneTheme, { active: justMeditated }),
            transform: justMeditated ? "scale(0.95)" : "scale(1)",
            transition: "all 0.15s ease",
          }}
        >⊙ 打坐{justMeditated ? "…" : ""}</span>
      </div>
      {interactMode !== "whisper" && interactMode !== "pigeon" && visibleNpcs.length > 0 && (
        <div className="mobile-people-row" style={{
          padding: "6px 14px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          borderTop: `1px solid ${zoneTheme.border}`, flexWrap: "wrap",
        }}>
          <span style={{ color: zoneTheme.textDim, fontSize: "10px", flexShrink: 0 }}>人选：</span>
          <span
            className="mobile-touch-target mobile-person-chip"
            onClick={() => { setActiveTarget(null); setTalkTarget(null); }}
            style={chromeBtn(zoneTheme, { active: !activeTarget })}
          >全部</span>
          {visibleNpcs.map(npc => {
            const isSelected = activeTarget === npc.name;
            return (
              <span
                key={npc.name}
                className="mobile-touch-target mobile-person-chip"
                onClick={() => { setActiveTarget(npc.name); if (interactMode !== "action") setTalkTarget(npc.name); }}
                title={isSelected ? "点击「全部」取消选定" : `聚焦 ${npc.name}`}
                style={chromeBtn(zoneTheme, { active: isSelected })}
              >{npc.name}</span>
            );
          })}
        </div>
      )}
      {children}
      <GroundItemStrip items={groundItems} theme={zoneTheme} onPickUp={handleCollectGround} />
    </>
  );
}
