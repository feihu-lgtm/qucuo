import { hasInnerMap, getBuildingIdForInnerRoom, getResidentRoomForNpc, getDistrictAnchor, getInnerRoom, isNpcVisibleInInnerRoom, visibleInnerExits } from "../innerMap.js";
import { getBuildingsForLocation, BUILDING_TYPE_LABEL } from "../buildings/qucuoBuildings.js";
import { isNpcKnown } from "../npcAwareness.js";
import { npcAffectionLabel } from "../mvu.js";
import { inferActivePortraitTarget, SNOW_LEOPARD_FORMS, snowLeopardPortraitUrl, narratorPortraitUrl, narratorPortraitLabel, resolvePortrait } from "../portraits.js";
import { QUCUO_MAP, isNodeUnlocked } from "../qucuoMap.js";
import { QUALITY_COLOR } from "../equipment.js";
import { DIRS, getTimeStr } from "../utils/mudHelpers.js";
import NineGridMap from "../NineGridMap.jsx";

export default function LeftPanel({
  isMobile, mobileDrawer, setMobileDrawer,
  zoneTheme, S,
  room, innerRoomName, time,
  varTree, char,
  showDebug,
  peoplePanel, setPeoplePanel,
  activeBuilding, setActiveBuilding,
  setActiveItemMenu,
  setActiveNpcMenu,
  setCharacterPageTarget, setShowCharacterPage,
  setPigeonTarget, setInteractMode, inputRef, addLog,
  pigeonTarget,
  portraits, portraitTarget, setPortraitTarget,
  interactMode, activeTarget, talkTarget,
  playerAvatar,
  slImgErr, setSlImgErr, slForm, setSnowLeopardForm, setSlFormState,
  narratorAffection, narratorImgErr, setNarratorImgErr,
  companionState,
  setShowPortraitManager,
  mapView, setMapView, mapBig, setMapBig,
  mapData, questProgress, flags, inv,
  inSeaOfMind, seaGate, enterSeaOfMind, leaveSeaOfMind,
  loading, act, autoTravelTo,
  uiGreen, uiPink,
}) {
  return (
    <div style={isMobile
      ? { position: "fixed", top: 0, bottom: 0, left: 0, width: "82vw", maxWidth: 340, zIndex: 41,
          transform: mobileDrawer === "left" ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .28s ease", boxShadow: mobileDrawer === "left" ? "4px 0 24px rgba(0,0,0,.6)" : "none",
          background: zoneTheme.bg, display: "flex", flexDirection: "column", overflow: "hidden" }
      : { flex: 25, ...S.panel }}>
      {isMobile && (
        <div onClick={() => setMobileDrawer(null)} style={{ textAlign: "right", padding: "8px 12px", color: zoneTheme.textDim, cursor: "pointer", fontSize: "13px", flexShrink: 0 }}>关闭 ✕</div>
      )}
      <div style={S.label}>天地 <span style={{ fontSize: "9.5px", color: zoneTheme.textDim, letterSpacing: "1px" }}>· {zoneTheme.name}</span></div>
      <div style={S.scroll}>
        <div style={{ color: zoneTheme.accent, fontWeight: "bold", fontSize: "14px", marginBottom: 4, letterSpacing: "1px" }}>
          {room.name}
          {hasInnerMap(room.name) && innerRoomName && (
            <span style={{ color: zoneTheme.accentDim, fontWeight: "normal", fontSize: "11px", marginLeft: 6, letterSpacing: 0 }}>· {innerRoomName}</span>
          )}
        </div>
        <div style={{ color: zoneTheme.textDim, fontSize: "10.5px", marginBottom: 10 }}>{getTimeStr(time)}</div>
        <div style={{ color: zoneTheme.text, fontSize: "12px", marginBottom: 14, lineHeight: 1.9 }}>{room.desc}</div>

        <div style={{ color: zoneTheme.accentDim, fontSize: "10.5px", marginBottom: 5, letterSpacing: "1px" }}>出口 <span style={{ color: zoneTheme.textDim, fontSize: "9.5px" }}>（在下方输入框打字移动）</span></div>
        <div style={{ marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {room.exits.map(e => (<span key={e} style={{ color: zoneTheme.accent }}>{DIRS[e] || e}</span>))}
          {room.exits.length === 0 && <span style={{ color: zoneTheme.textDim }}>无路可走</span>}
        </div>

        {/* 心灵之海入口。只在"站在自己的安全屋里 + 已被玄女点破"时出现——
            往人心里走不是往地图上走，得有个能关上门的地方。在海里时这里变成出口。 */}
        {(inSeaOfMind || seaGate?.ok) && (
          <div
            onClick={inSeaOfMind ? leaveSeaOfMind : enterSeaOfMind}
            style={{
              marginBottom: 14, padding: "7px 10px", borderRadius: 4, cursor: "pointer", userSelect: "none",
              border: "1px solid #b8942a", background: "rgba(184,148,42,0.10)",
              color: "#e8c86a", fontSize: "11.5px", textAlign: "center",
            }}
          >
            {inSeaOfMind ? "⟡ 睁开眼，回去" : "⟡ 闭上眼，进心灵之海"}
          </div>
        )}

        {(() => {
          const all = getBuildingsForLocation(room.name);
          let list = all;
          if (hasInnerMap(room.name) && innerRoomName) {
            const bid = getBuildingIdForInnerRoom(room.name, innerRoomName);
            list = bid ? all.filter(b => b.id === bid) : [];
          }
          return list.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: zoneTheme.accentDim, fontSize: "10.5px", marginBottom: 5, letterSpacing: "1px" }}>此地建筑</div>
            {list.map(b => (
              <div key={b.id} onClick={() => setActiveBuilding(activeBuilding?.id === b.id ? null : b)}
                style={{ cursor: "pointer", marginBottom: 3 }}>
                <span style={{ color: activeBuilding?.id === b.id ? zoneTheme.accent : "#8ac8b8", fontSize: "12px" }}>{b.name}</span>
                <span style={{ color: "#5a5a4a", fontSize: "10.5px", marginLeft: 6 }}>{BUILDING_TYPE_LABEL[b.type] || ""}</span>
              </div>
            ))}
          </div>
          );
        })()}

        <div style={{ color: zoneTheme.accentDim, fontSize: "11px", marginBottom: 3 }}>此地之物</div>
        <div style={{ marginBottom: 10 }}>
          {(room.items || []).length === 0 && <div style={{ color: zoneTheme.textDim, fontSize: "11px" }}>地上空无一物</div>}
          {(room.items || []).map((it, i) => {
            const nm = typeof it === "object" ? it.name : it;
            const col = (typeof it === "object" && QUALITY_COLOR[it.quality]) || "#c4a040";
            return (
              <div key={(typeof it === "object" && it.id) || i}
                onClick={() => setActiveItemMenu({ item: it, mode: "ground" })}
                style={{ fontSize: "11.5px", color: col, cursor: "pointer", marginBottom: 2, textDecoration: "underline", textDecorationStyle: "dotted", textDecorationColor: zoneTheme.textDim }}>
                · {nm}{typeof it === "object" && it.quality ? `（${it.quality}）` : ""}
              </div>
            );
          })}
        </div>

        {(() => {
          const present = room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n));
          const everSeen = varTree.世界?.曾经出现人物 || [];
          const presentNames = new Set(room.npcs.map(n => n.name));
          const absent = everSeen.filter(nm => !presentNames.has(nm));
          const dbgPeople = showDebug && (
            <div style={{ fontSize: "9.5px", color: "#7a6a4a", background: "#12100a", border: "1px solid #2a2410", borderRadius: 3, padding: "4px 6px", marginBottom: 6, lineHeight: 1.5, wordBreak: "break-all" }}>
              <div>当前内层房间: {innerRoomName || "(无/全显示)"} · room.npcs 共 {room.npcs.length} 人</div>
              {room.npcs.map((n, i) => {
                const bound = hasInnerMap(room.name) ? getResidentRoomForNpc(room.name, n.name) : null;
                const vis = isNpcVisibleInInnerRoom(room.name, innerRoomName, n);
                return <div key={i}>{vis ? "●" : "○"} {n.name} · 驻{bound || "-"} · 落{n.innerRoom || "-"}</div>;
              })}
            </div>
          );
          const header = (label, count, key, color, rightContent) => (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", marginBottom: 4 }}>
              <span onClick={() => setPeoplePanel(p => ({ ...p, [key]: !p[key] }))}
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none", flex: 1 }}>
                <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>{peoplePanel[key] ? "▾" : "▸"}</span>
                <span style={{ color }}>{label}</span>
                <span style={{ color: zoneTheme.textDim, fontSize: "10px" }}>（{count}）</span>
              </span>
              {rightContent}
            </div>
          );
          const pigeonBadge = (
            <span style={{ fontSize: "10px", color: (char.pigeons || 0) > 0 ? "#c4a040" : zoneTheme.textDim, flexShrink: 0 }} title={`现有信鸽 ${char.pigeons || 0} 只`}>
              🕊{char.pigeons || 0}
            </span>
          );
          return (
            <div style={{ marginBottom: 10 }}>
              {dbgPeople}
              {header("此地之人 · 在场", present.length, "present", zoneTheme.accentDim, pigeonBadge)}
              {peoplePanel.present && (present.length === 0
                ? <div style={{ color: zoneTheme.textDim, fontSize: "11px", marginBottom: 8, paddingLeft: 16 }}>空无一人</div>
                : <div style={{ marginBottom: 8 }}>{present.map((n, i) => {
                    const known = isNpcKnown(varTree, n.name);
                    const attrs = varTree.角色?.[n.name] || {};
                    const hasAffection = known && typeof attrs.好感度 === "number";
                    return (
                      <div key={i} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: i < present.length - 1 ? `1px solid ${zoneTheme.border}` : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ color: uiGreen, flex: 1 }}>
                            {n.name}<span style={{ color: zoneTheme.textDim, fontSize: "11px", marginLeft: 6 }}>{n.brief}</span>
                          </span>
                          {hasAffection ? (
                            <span style={{ fontSize: "10.5px", flexShrink: 0, textAlign: "right", whiteSpace: "nowrap" }} title={`好感度 ${attrs.好感度}/100`}>
                              <span style={{ color: uiPink }}>{npcAffectionLabel(attrs.好感度)}</span>
                              <span style={{ color: zoneTheme.textDim, marginLeft: 4 }}>{attrs.好感度}</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: "10px", color: zoneTheme.textDim, flexShrink: 0, whiteSpace: "nowrap" }}>{known ? "" : "尚未认识"}</span>
                          )}
                        </div>
                        <span onClick={() => setActiveNpcMenu(n)} title="打开互动菜单：细看/切磋/偷窃/对话/送礼/拜师"
                          style={{ fontSize: "10px", color: zoneTheme.accent, cursor: "pointer", display: "block", marginTop: 2 }}>◈ 角色面板</span>
                      </div>
                    );
                  })}</div>)}
              {absent.length > 0 && (
                <div style={{ paddingTop: 6, borderTop: `1px solid ${zoneTheme.border}` }}>
                  {header("曾遇 · 不在场", absent.length, "absent", "#c8bfa0")}
                  {peoplePanel.absent && absent.map(name => {
                    const known = isNpcKnown(varTree, name);
                    const attrs = varTree.角色?.[name] || {};
                    const hasAff = known && typeof attrs.好感度 === "number";
                    return (
                      <div key={name} style={{ marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span onClick={() => { setCharacterPageTarget(name); setShowCharacterPage(true); }} title="打开此人详情面板"
                            style={{ cursor: "pointer", color: "#c8bfa0", flex: 1, fontSize: "11px" }}>{name}</span>
                          <span onClick={() => {
                              if ((char.pigeons || 0) <= 0) { addLog([{ t: "sys", text: `  没有信鸽——去驿站买鸽子，或到驿站直接寄信/送礼给${name}。` }]); return; }
                              setPigeonTarget(name); setInteractMode("pigeon"); setTimeout(() => inputRef.current?.focus(), 0);
                            }}
                            title={(char.pigeons || 0) > 0 ? `飞鸽传书（现有信鸽 ${char.pigeons} 只，寄一封耗一只·只送信）` : "需先去驿站买信鸽"}
                            style={{ fontSize: "10px", color: (char.pigeons || 0) <= 0 ? zoneTheme.textDim : (pigeonTarget === name ? zoneTheme.accent : "#c4a040"), cursor: "pointer", flexShrink: 0 }}>🕊飞鸽</span>
                          {hasAff ? (
                            <span style={{ fontSize: "10px", flexShrink: 0, whiteSpace: "nowrap" }} title={`好感度 ${attrs.好感度}/100`}>
                              <span style={{ color: uiPink }}>{npcAffectionLabel(attrs.好感度)}</span>
                              <span style={{ color: zoneTheme.textDim, marginLeft: 4 }}>{attrs.好感度}</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: "10px", color: zoneTheme.textDim, flexShrink: 0, whiteSpace: "nowrap" }}>{known ? "" : "尚未认识"}</span>
                          )}
                        </div>
                        {known && attrs.态度 && <div style={{ fontSize: "9.5px", color: "#5a5a4a" }}>{attrs.态度}</div>}
                        {known && attrs.生气状态?.active && (
                          <div style={{ fontSize: "9.5px", color: "#e0526a" }}>⚡ 气头上（{attrs.生气状态.reason}），还剩 {attrs.生气状态.turnsLeft} 回合</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 14, marginTop: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: zoneTheme.accentDim, fontSize: "10.5px", letterSpacing: "1px" }}>立绘</span>
            <span onClick={() => setShowPortraitManager(true)} style={{ color: zoneTheme.textDim, fontSize: "10px", cursor: "pointer" }}>⚙ 管理</span>
          </div>
          {(() => {
            const candidates = ["旁白", "你", ...room.npcs.filter(n => isNpcVisibleInInnerRoom(room.name, innerRoomName, n)).map(n => n.name)];
            const target = portraitTarget && candidates.includes(portraitTarget) ? portraitTarget : inferActivePortraitTarget(interactMode, room, activeTarget || talkTarget);
            const isSnowLeopard = target === "雪豹";
            // 旁白立绘按好感度自动切档（五档：声之涟漪→水手服的猫→猫裹黄裙→人形剪影→真容）。
            // 与雪豹的差别：雪豹三形态是玩家手动选，旁白这五张是显形进度条，玩家不能选。
            // 但若玩家在「⚙管理」里手动传过旁白立绘，仍以他自己传的为准——不夺用户的手。
            const isNarrator = target === "旁白";
            const img = isSnowLeopard
              ? (slImgErr ? null : snowLeopardPortraitUrl(slForm))
              : isNarrator
                ? (portraits["旁白"] || (narratorImgErr ? null : narratorPortraitUrl(narratorAffection)))
                // 走 resolvePortrait 才能吃到内置默认立绘（玄女/梅朵/何雨谢那批）——
                // 直接读 portraits[target] 只拿得到玩家自己上传的那份。
                : (target === "你" ? (portraits["你"] || playerAvatar) : resolvePortrait(portraits, target));
            return (
              <>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                  {candidates.map(name => (
                    <span
                      key={name}
                      onClick={() => setPortraitTarget(name)}
                      style={{
                        fontSize: "10px", padding: "2px 6px", borderRadius: 3, cursor: "pointer",
                        color: target === name ? zoneTheme.bg : zoneTheme.accent,
                        background: target === name ? zoneTheme.accent : zoneTheme.bgPanel,
                        border: `1px solid ${zoneTheme.border}`,
                      }}
                    >{name}</span>
                  ))}
                </div>
                <div style={{
                  width: "100%", aspectRatio: "2/3", background: zoneTheme.bgPanel, borderRadius: 4,
                  border: `1px solid ${zoneTheme.border}`, display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                }}>
                  {img ? (
                    <img src={img} alt={target} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={isSnowLeopard ? () => setSlImgErr(true) : isNarrator ? () => setNarratorImgErr(true) : undefined} />
                  ) : (
                    <span style={{ color: zoneTheme.textDim, fontSize: "11px", textAlign: "center", padding: "0 8px" }}>
                      {isSnowLeopard && slImgErr ? "雪豹立绘待投放（portraits/snowleopard/）"
                        : isNarrator && narratorImgErr ? "旁白立绘待投放（portraits/narrator/）"
                        : `${target} 暂无立绘`}
                    </span>
                  )}
                </div>
                {/* 旁白：标出当前是第几形态。她的立绘是好感度进度条，不给切换按钮——
                    这跟雪豹三形态（玩家想看哪个看哪个）是两回事，显形到哪一步由好感度说了算。 */}
                {isNarrator && !portraits["旁白"] && (
                  <div style={{ marginTop: 6, textAlign: "center", fontSize: "9.5px", color: zoneTheme.textDim }}>
                    {narratorPortraitLabel(narratorAffection)}
                    <span style={{ color: zoneTheme.accentDim }}>　好感 {narratorAffection}</span>
                  </div>
                )}
                {isSnowLeopard && (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, justifyContent: "center" }}>
                    {SNOW_LEOPARD_FORMS.map(f => (
                      <span key={f.key}
                        onClick={() => { setSnowLeopardForm(f.key); setSlFormState(f.key); setSlImgErr(false); }}
                        style={{
                          fontSize: "9.5px", padding: "2px 7px", borderRadius: 3, cursor: "pointer", userSelect: "none",
                          color: slForm === f.key ? zoneTheme.bg : zoneTheme.accent,
                          background: slForm === f.key ? zoneTheme.accent : zoneTheme.bgPanel,
                          border: `1px solid ${zoneTheme.border}`,
                        }}>{f.label}</span>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
        {companionState?.snowLeopard?.unlocked && (
          <div style={{ borderTop: `1px solid ${zoneTheme.border}`, paddingTop: 14, marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ color: zoneTheme.accentDim, fontSize: "10.5px", letterSpacing: "1px" }}>雪豹 · 随行</span>
            </div>
            <div style={{
              width: "100%", aspectRatio: "2/3", background: zoneTheme.bgPanel, borderRadius: 4,
              border: `1px solid ${zoneTheme.border}`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
            }}>
              {!slImgErr ? (
                <img src={snowLeopardPortraitUrl(slForm)} alt="雪豹" style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  onError={() => setSlImgErr(true)} />
              ) : (
                <span style={{ color: zoneTheme.textDim, fontSize: "11px", textAlign: "center", padding: "0 8px" }}>雪豹立绘待投放（portraits/snowleopard/）</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 6, justifyContent: "center" }}>
              {SNOW_LEOPARD_FORMS.map(f => (
                <span key={f.key}
                  onClick={() => { setSnowLeopardForm(f.key); setSlFormState(f.key); setSlImgErr(false); }}
                  style={{
                    fontSize: "9.5px", padding: "2px 7px", borderRadius: 3, cursor: "pointer", userSelect: "none",
                    color: slForm === f.key ? zoneTheme.bg : zoneTheme.accent,
                    background: slForm === f.key ? zoneTheme.accent : zoneTheme.bgPanel,
                    border: `1px solid ${zoneTheme.border}`,
                  }}>{f.label}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{ borderTop: `1px solid ${zoneTheme.border}`, padding: "6px 12px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ color: zoneTheme.accentDim, fontSize: "10px", cursor: "pointer" }} onClick={() => setMapBig(true)} title="点击放大">
            {mapView === "inner" ? "村图·内" : "舆图·外"} <span style={{ color: zoneTheme.textDim }}>⤢放大{mapView === "outer" ? " · 点已探明据点自动前往" : ""}</span>
          </span>
          {hasInnerMap(room.name) && (
            <span style={{ display: "flex", fontSize: "9.5px", flexShrink: 0 }}>
              {[["outer", "外"], ["inner", "内"]].map(([v, lb]) => (
                <span key={v} onClick={() => setMapView(v)}
                  style={{ cursor: "pointer", padding: "1px 7px",
                    color: mapView === v ? zoneTheme.bg : zoneTheme.accent,
                    background: mapView === v ? zoneTheme.accent : zoneTheme.bgPanel,
                    border: `1px solid ${zoneTheme.border}` }}>{lb}</span>
              ))}
            </span>
          )}
        </div>
        {mapView === "outer" && (() => {
          const completedQuests = new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id));
          const exitByDir = QUCUO_MAP[room.name]?.exits || {};
          const DIRS8 = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
          const cells = {};
          for (const dir of DIRS8) {
            const dest = exitByDir[dir];
            const explored = !!(dest && mapData[dest]);
            cells[dir] = explored ? { explored: true, name: dest, dir } : { explored: false, dir };
          }
          const go = (dir) => {
            if (loading) return;
            const dest = exitByDir[dir];
            const completed = new Set(Object.entries(questProgress || {}).filter(([, p]) => p?.status === "completed" || p?.done).map(([id]) => id));
            if (dest && mapData[dest] && isNodeUnlocked(dest, { completedQuests: completed, flags })) { autoTravelTo(dest); return; }
            setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "outer" });
          };
          return <NineGridMap centerLabel={room.name} cells={cells} onGo={go} accent={zoneTheme.accent} loading={loading} big={mapBig} />;
        })()}
        {mapView === "inner" && (() => {
          if (!hasInnerMap(room.name)) return <div style={{ color: zoneTheme.textDim, fontSize: "10px" }}>此地无内景可绘。</div>;
          const curRoom = innerRoomName || getDistrictAnchor(room.name);
          // 上锁的房间不出现在九宫格里（此前这里直接读裸 exits，锁着的安全屋照样是可点格子）
          const curExits = (curRoom && visibleInnerExits(room.name, curRoom, { questProgress, flags, inv, char })) || {};
          const DIRS8 = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
          const cells = {};
          for (const dir of DIRS8) {
            const dest = curExits[dir];
            cells[dir] = dest ? { explored: true, name: dest, dir } : { explored: false, dir };
          }
          const go = (dir) => { if (!loading && curExits[dir]) { setInteractMode("action"); act(DIRS[dir] || dir, [], { forceLayer: "inner" }); } };
          return <NineGridMap centerLabel={curRoom} cells={cells} onGo={go} accent="#8ac48a" loading={loading} big={mapBig} />;
        })()}
      </div>
    </div>
  );
}
