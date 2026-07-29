// 立绘压缩
// ============================================================================
// 入册界面的立绘有三个来源：内置那十张（Vite 打包的静态资源）、角色卡自带的图
// （酒馆卡的 PNG 本身就是立绘，元数据藏在 tEXt chunk 里）、玩家自己上传的图。
// 后两者都是任意尺寸的原图，直接存会很大——一张 1024×1536 的 PNG 常见 1.5MB，
// 转成 base64 再膨胀三分之一，几十个角色就能把 IndexedDB 塞得很难看。
//
// 【为什么压成 webp 而不是原样存】立绘的实际显示尺寸最大也就两三百像素宽
//（LeftPanel 的立绘位、快速战斗的对峙区都是这个量级），存 1024 宽纯属浪费。
// webp 在这个尺寸上比 jpeg 省三到四成，且支持透明——卡图有透明背景的不少，
// 转 jpeg 会把透明填成黑块。
//
// 【为什么存 dataURL 而不是 Blob】它要跟着 importedRegistry 一起进 IndexedDB，
// 而那个库的值是走 structuredClone 存的普通对象。Blob 理论上也能存，但取出来
// 之后要 createObjectURL 才能用，且 URL 会随页面卸载失效，每次读档都得重新造一遍。
// dataURL 是自包含的字符串，存了就能直接当 img src，跟内置图的用法一致。

// 立绘的目标尺寸。9:16 竖版是 portraits.js 里定的建议比例，这里按它给上限，
// 但不强制裁切——原图是方的就让它保持方的，只是不许超过这个框。
export const PORTRAIT_MAX_W = 360;
export const PORTRAIT_MAX_H = 540;
export const PORTRAIT_QUALITY = 0.82;

/**
 * 等比缩到框内。纯函数，单独抽出来是因为 canvas 在测试环境里没有，
 * 而尺寸算错（比例变形、放大小图）是这类代码最容易出的错。
 *
 * 【为什么不放大】原图比框还小时按原尺寸留着。放大不会增加任何信息，
 * 只会让文件变大、边缘发虚。
 */
export function fitSize(w, h, maxW = PORTRAIT_MAX_W, maxH = PORTRAIT_MAX_H) {
  const sw = Number(w), sh = Number(h);
  if (!(sw > 0) || !(sh > 0)) return { w: 0, h: 0, scaled: false };
  const ratio = Math.min(maxW / sw, maxH / sh, 1);
  return {
    w: Math.max(1, Math.round(sw * ratio)),
    h: Math.max(1, Math.round(sh * ratio)),
    scaled: ratio < 1,
  };
}

/** 人话体积。dataURL 的 base64 段每 4 字符载 3 字节 */
export function dataUrlBytes(dataUrl) {
  const i = String(dataUrl || "").indexOf(",");
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  const pad = (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
  return Math.max(0, Math.floor(b64.length * 3 / 4) - pad);
}

export function fmtBytes(n) {
  if (!(n > 0)) return "0B";
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * 把图片源压成 webp dataURL。
 *
 * @param {Blob|File|Uint8Array} src 原图。Uint8Array 用于角色卡那条路——
 *        cardParse 拿到的就是 PNG 字节，不必再读一遍文件。
 * @param {object} opts { maxW, maxH, quality, mime }
 * @returns {Promise<{dataUrl:string, bytes:number, w:number, h:number, from:{w:number,h:number,bytes:number}}>}
 */
export async function compressImage(src, opts = {}) {
  const {
    maxW = PORTRAIT_MAX_W, maxH = PORTRAIT_MAX_H,
    quality = PORTRAIT_QUALITY, mime = "image/webp",
  } = opts;

  const blob = src instanceof Blob ? src : new Blob([src]);
  const bitmap = await loadBitmap(blob);
  const { w, h, scaled } = fitSize(bitmap.width, bitmap.height, maxW, maxH);
  if (!w || !h) throw new Error("这张图读不出尺寸，可能不是图片文件");

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  // 缩图质量：默认的 low 在缩到三分之一时锯齿明显
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (typeof bitmap.close === "function") bitmap.close();

  let dataUrl = canvas.toDataURL(mime, quality);
  // toDataURL 对不支持的 mime 会静默退回 image/png——不报错，只是白压一场。
  // 检出来就退到 jpeg（比 png 小得多），透明背景变白总比存 1.5MB 好。
  if (mime === "image/webp" && !dataUrl.startsWith("data:image/webp")) {
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return {
    dataUrl,
    bytes: dataUrlBytes(dataUrl),
    w, h, scaled,
    from: { w: bitmap.width, h: bitmap.height, bytes: blob.size || 0 },
  };
}

// createImageBitmap 是首选（不碰 DOM、能 close 掉省内存）。老 Safari 没有它，
// 退到 Image + objectURL。两条路都要在失败时把 URL 释放掉，否则每传一张漏一个。
function loadBitmap(blob) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片解码失败")); };
    img.src = url;
  });
}

/** 判断一个 portrait 字段值是不是自定义图（相对内置的文件名/角色名而言） */
export function isCustomPortrait(v) {
  return typeof v === "string" && /^(data:|blob:)/.test(v);
}
