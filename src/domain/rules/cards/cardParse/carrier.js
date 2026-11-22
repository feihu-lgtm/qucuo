// 载体读取（从 cardParse.js 拆出，纯搬运）
// 只认 PNG 里的 tEXt chunk / 裸 JSON 文本，把字节里的卡 JSON 挖出来。

function bytesToLatin1(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

// base64 → UTF-8 字符串。浏览器走 atob + TextDecoder，Node 走 Buffer。
function b64ToUtf8(b64) {
  const clean = b64.replace(/\s+/g, "");
  if (typeof atob === "function") {
    const bin = atob(clean);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(arr);
  }
  // eslint-disable-next-line no-undef
  return Buffer.from(clean, "base64").toString("utf-8");
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(bytes) {
  if (!bytes || bytes.length < 8) return false;
  return PNG_MAGIC.every((b, i) => bytes[i] === b);
}

/**
 * 读出 PNG 里的全部文本 chunk。
 * zTXt 需要 inflate，浏览器端没有内置同步 inflate，所以这里只记录它的存在、
 * 不解压（实测 8 张卡全部用 tEXt，没有一张用 zTXt，属于理论分支）。
 * @returns {{texts: Record<string,string>, zipped: string[]}} texts 的值是 latin1 原文
 */
function readPngTextChunks(bytes) {
  if (!isPng(bytes)) throw new Error("不是 PNG 文件");
  const texts = {};
  const zipped = [];
  let i = 8;
  while (i + 8 <= bytes.length) {
    const len = (bytes[i] << 24 | bytes[i + 1] << 16 | bytes[i + 2] << 8 | bytes[i + 3]) >>> 0;
    const type = bytesToLatin1(bytes.subarray(i + 4, i + 8));
    if (type === "IEND") break;
    if (type === "tEXt" || type === "zTXt") {
      const body = bytes.subarray(i + 8, i + 8 + len);
      const zero = body.indexOf(0);
      if (zero > 0) {
        const kw = bytesToLatin1(body.subarray(0, zero));
        if (type === "tEXt") texts[kw] = bytesToLatin1(body.subarray(zero + 1));
        else zipped.push(kw);
      }
    }
    i += 12 + len;
  }
  return { texts, zipped };
}

/**
 * 从 PNG 字节里取出角色卡 JSON。
 * F1：只认 keyword 精确等于 ccv3/chara。F2：两个都在时用 ccv3。
 */
export function extractCardJsonFromPng(bytes) {
  const { texts, zipped } = readPngTextChunks(bytes);
  const hasCcv3 = Object.prototype.hasOwnProperty.call(texts, "ccv3");
  const hasChara = Object.prototype.hasOwnProperty.call(texts, "chara");
  if (!hasCcv3 && !hasChara) {
    const found = Object.keys(texts).concat(zipped);
    const err = new Error(
      found.length
        ? `这张 PNG 里没有角色卡数据（只有 ${found.join("/")} 这些无关的文本块，多半是 AI 出图的元数据）`
        : "这张 PNG 里没有任何文本块，是一张普通图片"
    );
    err.code = "NOT_A_CARD";
    err.chunks = found;
    throw err;
  }
  const raw = hasCcv3 ? texts.ccv3 : texts.chara;
  // latin1 字符串本身就是 base64 的 ASCII 内容，直接解
  return {
    json: b64ToUtf8(raw),
    carrier: {
      hasCcv3, hasChara,
      used: hasCcv3 ? "ccv3" : "chara",
      // F3：只有 chara 时是 V2 载体，但这不代表内容是 V2，spec 字段要另读
      carrierGeneration: hasCcv3 ? "v3" : "v2",
    },
  };
}
