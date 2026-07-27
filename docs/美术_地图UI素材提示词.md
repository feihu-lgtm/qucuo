# 美术素材提示词 · 地图 UI 三件套（image-2 格式）

> 三张分开跑，各自内容不重叠。风格锚定包内现有资源：`stones/table.webp`（藏式独脚高台·
> 紫檀描金·镶绿松红珊瑚）、`stones/frames/frame_lux.webp`（华丽金框·祥云回纹莲台）、
> `stones/ui/*`（气泡/木牌/纸卷按钮底）。
>
> **通用铁律**（三张都要）：真透明背景、无文字、无水印、正交平视无透视、
> 元素之间留足空隙便于切图。生成后按 `docs/赌石完整制作方案_美术UI谈价立绘.md §G`
> 抠图去假透明（AI 出图几乎必是灰白棋盘格假透明，alpha 全 255）。

---

## 图一 · 九宫格小地图框（主地图）

> 用途：右栏常驻小地图。3×3 格子 + 外框 + 中心"我在此"高亮格 + 战争迷雾格。
> 目标尺寸 1024×1024，切图后单格约 120×120。

```
A game UI asset sheet on a fully transparent background, Tibetan-Himalayan
temple woodwork style: a square 3x3 grid map frame kit.

Contents, arranged in a single flat layout with clear gaps between pieces:
- one outer square frame with an empty hollow center, carved dark rosewood
  with gold-leaf inlay, corner cloud-scroll brackets, tiny turquoise and coral
  cabochons set at the four corners, a thin gold key-fret (回纹) border band
- nine square cell tiles of identical size, shown separately below the frame:
  (a) three plain idle tiles, dark slate-blue stone with faint gold rim
  (b) three "unexplored fog" tiles, near-black with a soft grey mist texture
      and a dashed gold-grey border
  (c) three "current location" tiles, warm jade-green glow from the center,
      bright gold double rim, subtle radiating light

Flat orthographic top-down view, no perspective, no drop shadows onto the
background. Muted palette: rosewood brown, antique gold, turquoise, coral red,
slate blue-black, jade green. Crisp clean edges suitable for 9-slice slicing.

No text, no letters, no numbers, no watermark, no character, no landscape.
Fully transparent background (real alpha, not a checkerboard pattern).
```

---

## 图二 · 放大卷轴（全境舆图底）

> 用途：点⤢放大后的全境拓扑图底板。中间大片留白给 SVG 节点连线，四周是卷轴装帧。
> 目标尺寸 1536×1024（横），中央可用区约占 78%。

```
A game UI asset on a fully transparent background: an unrolled horizontal
hanging scroll (thangka-style mounting) used as a map backing panel.

Design:
- a wide horizontal scroll, aged hemp-paper field in warm sand-beige with
  subtle fiber grain and faint water stains at the edges
- top and bottom wooden roller bars in dark rosewood with gold end-caps shaped
  like lotus buds, thin silk brocade mounting strips in deep indigo with a
  woven gold key-fret pattern
- a narrow decorative border inside the paper field: hand-inked mountain-range
  motif along the very edge only, extremely faint, low contrast
- the entire central area is CLEAN EMPTY PAPER, no drawings, no roads, no
  towns, no compass, no cartouche - it must stay blank for map nodes to be
  drawn on top programmatically
- two small brass hanging rings at the top corners

Flat orthographic front view, evenly lit, no perspective, no cast shadow.
Palette: sand-beige paper, rosewood, antique gold, deep indigo, faint ink grey.

No text, no letters, no numbers, no seal script, no watermark.
Fully transparent background outside the scroll silhouette (real alpha).
```

---

## 图三 · 地图零件与图标

> 用途：叠在前两张之上的可复用零件。全部小件，一张图出齐。
> 目标尺寸 1024×1024，每件切出来约 96–160px。

```
A game UI icon sheet on a fully transparent background, Tibetan-Himalayan
temple metalwork style. Small separate pieces laid out in a loose grid with
generous spacing, each piece fully self-contained and non-overlapping:

- a "you are here" marker: a small gold lotus-seat pedestal with a glowing
  jade-green flame above it
- a locked-gate seal: a small dark iron padlock with a coral cabochon and a
  gold ribbon, for gated destinations
- three fog-of-war puffs: soft grey-black mist blobs of slightly different
  shapes, semi-transparent
- a compass rose in Tibetan style: eight-petal lotus with gold cardinal spurs,
  no letters on it
- four path connectors: two straight rope-and-gold-stud road segments
  (horizontal, vertical) and two dashed faint-trail segments (diagonal)
- two circular buttons with hollow centers, dark rosewood rim with gold bead
  edge, for zoom controls
- a small brass ring handle and a tiny prayer-flag string of five square flags
  in blue, white, red, green, yellow, very small

Flat orthographic view, no perspective, crisp edges, evenly lit, no cast
shadows onto the background. Palette: antique gold, rosewood, iron grey,
turquoise, coral red, jade green, prayer-flag colors.

No text, no letters, no numbers, no watermark.
Fully transparent background (real alpha, not a checkerboard).
```

---

## 落地时的对应关系

| 素材 | 用在哪 |
|---|---|
| 图一·外框 | `NineGridMap` 容器（右栏小地图） |
| 图一·idle/fog/current 三种格 | `NineGridMap` 的 cellStyle 三态贴图 |
| 图二·卷轴 | 放大弹层 `ClickableMap` 的底板 |
| 图三·你在此 / 锁 | ClickableMap 的 `n.current` 标记、`n.locked` 的 🔒 位 |
| 图三·迷雾团 | 九宫格未探明格（替换现在的"?"字符） |
| 图三·路径连接 | ClickableMap 的 `<line>`（实线=已探明，虚线=引导） |
| 图三·圆钮 | `zmBtn` 缩放按钮底 |
| 图三·经幡/铜环 | 卷轴装饰点缀，可选 |
