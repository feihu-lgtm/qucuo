// 入册审改 · 立绘挑选（从 ReviewNpc.jsx 拆出）
import React, { useState, useRef } from "react";
import { Note } from "./widgets.jsx";
import { DEFAULT_PORTRAITS, resolveCardPortrait } from "../../../domain/rules/companion/portraits.js";
import { compressImage, isCustomPortrait, fmtBytes } from "./portraitCompress.js";

// ── 立绘 ──────────────────────────────────────────────────────────────────────

// 现成立绘只有这十张（assets/portraits/），都是既有 NPC 的。让入册角色借用一张
// 总比没有好；不选就只有名字，跟大多数路人一样。
// 内置立绘。
// 【为什么不再写英文文件名数组】原来是 ["caidan.webp", …] 配 PORTRAIT() 拼
// `${BASE}portraits/xxx.webp`，而这十张在 src/assets/portraits/ 走 Vite import，
// public/portraits/ 下压根没有它们——十张全 404，onError 又把破图隐藏掉，于是
// 这一节看起来只有一个"不设"按钮。改成直接读 DEFAULT_PORTRAITS，键是角色名，
// 值是打包后的 URL。存进 portrait 字段的是**键名**（打包 URL 带 content hash，
// 存下来下次构建就失效），读时过 resolveCardPortrait 查表。
const BUILTIN_PORTRAITS = Object.keys(DEFAULT_PORTRAITS);

export default function PortraitPicker({ value, onChange, cardImage, npcName }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState(null);   // 刚压完那张的体积信息
  const fileRef = useRef(null);

  const custom = isCustomPortrait(value);
  const shown = resolveCardPortrait(value);

  const take = async (src, label) => {
    setBusy(label); setErr(""); setInfo(null);
    try {
      const out = await compressImage(src);
      onChange(out.dataUrl);
      setInfo(out);
    } catch (e) {
      setErr(String(e?.message || e).slice(0, 60));
    } finally {
      setBusy("");
    }
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";                    // 同一张图连传两次也要能触发
    if (f) take(f, "上传");
  };

  const thumb = (on) => ({
    width: 46, height: 46, objectFit: "cover", borderRadius: 0, cursor: "pointer",
    border: `1px solid ${on ? "var(--ink-warn)" : "var(--bg-card)"}`,
    filter: on ? "none" : "grayscale(.5) brightness(.8)",
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7, flexWrap: "wrap" }}>
        <span onClick={() => { onChange(""); setInfo(null); setErr(""); }}
          style={{
            cursor: "pointer", fontSize: 10.5, padding: "4px 10px", borderRadius: 0,
            border: `1px solid ${!value ? "var(--ink-warn)" : "var(--border-deep)"}`,
            color: !value ? "var(--ink-warn)" : "var(--ink-muted)",
          }}>不设</span>

        {/* 卡自带的图。酒馆卡的 PNG 本身就是立绘，角色卡数据藏在它的 tEXt chunk 里，
            所以"用卡的图"就是把这张 PNG 压一份留下 */}
        <span onClick={() => cardImage && !busy && take(cardImage, "卡图")}
          title={cardImage ? "这张卡的 PNG 本身就是立绘，压成 webp 存下来"
            : "这张卡不是 PNG（裸 JSON 卡没有图），只能上传或用内置的"}
          style={{
            cursor: cardImage && !busy ? "pointer" : "not-allowed",
            fontSize: 10.5, padding: "4px 10px", borderRadius: 0,
            border: `1px solid ${cardImage ? "#4a6a48" : "var(--bg-card)"}`,
            color: cardImage ? "#9ac088" : "#4a4436",
            opacity: cardImage ? 1 : .55,
          }}>
          {busy === "卡图" ? "压缩中…" : "用卡自带的图"}
        </span>

        <span onClick={() => !busy && fileRef.current?.click()}
          title="选一张本地图片，压成 webp 存下来"
          style={{
            cursor: busy ? "wait" : "pointer", fontSize: 10.5, padding: "4px 10px", borderRadius: 0,
            border: "1px solid var(--border-deep)", color: "var(--ink-muted)",
          }}>
          {busy === "上传" ? "压缩中…" : "上传一张"}
        </span>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />

        <span style={{ flex: 1 }} />
        {custom && (
          <span style={{ fontSize: 9, color: "#9ac088", border: "1px solid #4a6a48", borderRadius: 0, padding: "0 4px" }}>
            自备图
          </span>
        )}
      </div>

      {/* 当前这张的预览。自备图给大一点，因为它是玩家刚挑的、要看清 */}
      {shown && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 8 }}>
          <img src={shown} alt={npcName || ""}
            style={{
              width: custom ? 68 : 46, height: custom ? 100 : 46,
              objectFit: "cover", objectPosition: "top center",
              borderRadius: 0, border: "1px solid #4a4028",
            }} />
          <div style={{ fontSize: 10, color: "var(--ink-muted)", lineHeight: 1.8 }}>
            {custom ? "已存进入册库，跟着这个角色一起落册。" : `内置立绘 · ${value}`}
            {info && (
              <>
                <br />
                <span style={{ color: "#9ac088" }}>
                  {info.from.w}×{info.from.h}
                  {info.from.bytes ? ` ${fmtBytes(info.from.bytes)}` : ""}
                  {" → "}{info.w}×{info.h} {fmtBytes(info.bytes)}
                </span>
                {!info.scaled && <span style={{ color: "var(--ink-text-dim)" }}>（原图已在框内，未放大）</span>}
              </>
            )}
          </div>
        </div>
      )}
      {err ? <Note tone="bad">{err}</Note> : null}

      <div style={{ fontSize: 10, color: "var(--ink-text-dim)", marginBottom: 4 }}>或用内置的十张</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {BUILTIN_PORTRAITS.map(name => (
          <img key={name} src={DEFAULT_PORTRAITS[name]} alt={name} title={name}
            onClick={() => { onChange(name); setInfo(null); setErr(""); }}
            style={thumb(value === name)} />
        ))}
      </div>
    </div>
  );
}

