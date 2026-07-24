// ComfyUI 云端立绘生成
// 协议参考 MoRanJiangHu 项目（github.com/ypq123456789/MoRanJiangHu）验证过的核心流程：
// POST 工作流到 /prompt 换 prompt_id，轮询 /history/{id} 直到完成，
// 从输出节点里取 filename/subfolder，拼 /view 地址取图。
// 这里只搬运"跑通一次生成"必需的部分——不做它那套面向多用户生产环境的
// 后端自动发现/连接成功率排序/直连代理双通道兜底，qucuo 是本地单人项目，
// 一个填得进去的云端地址就够用。

const COMFY_CONFIG_KEY = "wuxia_mud_comfyui_config";
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 90000;

export function defaultComfyConfig() {
  return {
    enabled: false,
    baseUrl: "",      // 云端 ComfyUI 实例地址，例如 https://xxxx.example.com:8188
    workflowJson: "", // ComfyUI 页面菜单「Save (API Format)」导出的工作流 JSON
    width: 768,
    height: 1152,     // 9:16，跟 portraits.js 里立绘的建议比例一致
    steps: 20,
    cfg: 7,
    negativePrompt: "lowres, bad anatomy, worst quality, watermark, blurry",
  };
}

export function loadComfyConfig() {
  try {
    const raw = localStorage.getItem(COMFY_CONFIG_KEY);
    return raw ? { ...defaultComfyConfig(), ...JSON.parse(raw) } : defaultComfyConfig();
  } catch {
    return defaultComfyConfig();
  }
}

export function saveComfyConfig(cfg) {
  localStorage.setItem(COMFY_CONFIG_KEY, JSON.stringify(cfg));
}

// 本地开发服务器已有一个通用 CORS 转发中间件（vite.config.js 的 /api/proxy），
// 直接复用同一条路径——云端 ComfyUI 实例同样存在跨域限制，走法跟主 LLM 接口一致。
function withProxy(url) {
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "/api/proxy?url=" + encodeURIComponent(url);
  }
  return url;
}

function isPositiveTextNode(node) {
  const title = String(node?._meta?.title || "").toLowerCase();
  const text = String(node?.inputs?.text || "").toLowerCase();
  if (/negative|负向|负面|反向/.test(title)) return false;
  if (/positive|prompt|正向|正面|提示词/.test(title)) return true;
  return !/lowres|bad anatomy|worst quality|watermark|nsfw/.test(text);
}

function isNegativeTextNode(node) {
  const title = String(node?._meta?.title || "").toLowerCase();
  const text = String(node?.inputs?.text || "").toLowerCase();
  return /negative|负向|负面|反向/.test(title) || /lowres|bad anatomy|worst quality|watermark/.test(text);
}

// 把用户粘贴的 ComfyUI API 格式工作流，按节点类型/标题猜出正向、负向提示词节点，
// 尺寸节点，采样器节点，直接把这次生成要用的值写进去。不做"先转占位符模板、
// 再注入替换"那层间接——qucuo 只跑用户自己这一份工作流，不需要维护模板库。
function buildWorkflow(workflowJsonText, { prompt, negativePrompt, width, height, steps, cfg }) {
  let workflow;
  try {
    workflow = JSON.parse(workflowJsonText);
  } catch {
    throw new Error("ComfyUI 工作流 JSON 解析失败，请确认粘贴的是「Save (API Format)」导出的内容");
  }
  if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new Error("ComfyUI 工作流 JSON 必须是一个对象");
  }
  workflow = JSON.parse(JSON.stringify(workflow)); // 深拷贝，不污染用户保存的原始配置

  const nodes = Object.values(workflow).filter(n => n && typeof n === "object" && n.inputs);
  let positiveDone = false, negativeDone = false;
  for (const node of nodes) {
    const classType = String(node.class_type || "").toLowerCase();
    const inputs = node.inputs;
    if (typeof inputs.text === "string" && /cliptextencode|textencode|prompt/.test(classType)) {
      if (!negativeDone && isNegativeTextNode(node)) { inputs.text = negativePrompt; negativeDone = true; }
      else if (!positiveDone && isPositiveTextNode(node)) { inputs.text = prompt; positiveDone = true; }
    }
    if (/emptylatentimage|latent/.test(classType)) {
      if ("width" in inputs) inputs.width = width;
      if ("height" in inputs) inputs.height = height;
    }
    if (/ksampler|sampler/.test(classType)) {
      if ("seed" in inputs) inputs.seed = Math.floor(Math.random() * 2 ** 32);
      if ("steps" in inputs) inputs.steps = steps;
      if ("cfg" in inputs) inputs.cfg = cfg;
    }
  }
  // 没识别出任何正向提示词节点（标题/内容都不像）：兜底找第一个带 text 输入的节点，
  // 总得有个地方把提示词塞进去，好过直接生成失败。
  if (!positiveDone) {
    const fallback = nodes.find(n => typeof n.inputs.text === "string");
    if (fallback) fallback.inputs.text = prompt;
  }
  return workflow;
}

async function pollHistory(baseUrl, promptId, signal) {
  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error(`ComfyUI 生图超过 ${Math.round(POLL_TIMEOUT_MS / 1000)} 秒仍未完成，任务可能仍在后端排队，未做自动重试`);
    }
    const res = await fetch(withProxy(`${baseUrl}/history/${encodeURIComponent(promptId)}`), { signal });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const entry = data?.[promptId];
      if (entry?.status?.completed) return entry;
      if (entry?.status?.status_str === "error") {
        throw new Error("ComfyUI 工作流执行出错，请检查节点参数或服务器日志");
      }
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
}

function extractImageInfo(historyEntry) {
  const outputs = historyEntry?.outputs || {};
  for (const nodeOutput of Object.values(outputs)) {
    const images = nodeOutput?.images;
    if (Array.isArray(images) && images.length) {
      return images.find(i => i.type === "output") || images[0];
    }
  }
  return null;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 主入口：给一段外貌提示词，跑一次云端 ComfyUI 生成，返回 base64 data URL——
// 跟手动上传走同一套 portraits.js 存储，不留远程引用。云端实例哪天重启、
// 换了地址甚至下线，已经生成好、存进本地的立绘完全不受影响。
export async function generateComfyUIPortrait(prompt, signal) {
  const cfg = loadComfyConfig();
  if (!cfg.baseUrl.trim()) throw new Error("请先在立绘管理里填写 ComfyUI 云端地址");
  if (!cfg.workflowJson.trim()) throw new Error("请先粘贴 ComfyUI 工作流 JSON（页面菜单「Save (API Format)」导出）");

  const baseUrl = cfg.baseUrl.trim().replace(/\/+$/, "");
  const workflow = buildWorkflow(cfg.workflowJson, {
    prompt, negativePrompt: cfg.negativePrompt, width: cfg.width, height: cfg.height, steps: cfg.steps, cfg: cfg.cfg,
  });

  const enqueueRes = await fetch(withProxy(`${baseUrl}/prompt`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: "qucuo-web" }),
    signal,
  });
  if (!enqueueRes.ok) {
    const detail = await enqueueRes.text().catch(() => "");
    throw new Error(`ComfyUI 提交失败：${enqueueRes.status}${detail ? " - " + detail.slice(0, 200) : ""}`);
  }
  const enqueuePayload = await enqueueRes.json().catch(() => null);
  const promptId = enqueuePayload?.prompt_id;
  if (!promptId) throw new Error("ComfyUI 返回结果里没有 prompt_id，请确认地址和工作流是否正确");

  const historyEntry = await pollHistory(baseUrl, promptId, signal);
  const imgInfo = extractImageInfo(historyEntry);
  if (!imgInfo) throw new Error("ComfyUI 已完成但没有找到输出图片，请检查工作流里的保存图片节点");

  const viewParams = new URLSearchParams({ filename: imgInfo.filename, subfolder: imgInfo.subfolder || "", type: imgInfo.type || "output" });
  const imageRes = await fetch(withProxy(`${baseUrl}/view?${viewParams.toString()}`), { signal });
  if (!imageRes.ok) throw new Error(`ComfyUI 取图失败：${imageRes.status}`);
  const blob = await imageRes.blob();
  return blobToDataUrl(blob);
}
