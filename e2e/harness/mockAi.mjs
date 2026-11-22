function textFrom(response) {
  if (typeof response === "string") return response;
  return JSON.stringify(response);
}

function defaultResponse(record) {
  const prompt = (record.body?.messages || []).map((message) => message.content || "").join("\n");
  if (record.kind === "prerun") {
    const names = [...prompt.matchAll(/据点：([^｜\n]+)/g)].map((match) => match[1].trim());
    return names.map((name) => ({ name, desc: "风过山口，溪声沿石阶缓缓流去。", lookText: "远山连绵，村道在溪边转向。" }));
  }
  if (record.kind === "extraction") return {};
  const narration = "风过鱼定村，溪声在石阶间潺潺回响。";
  return record.narrativeOnly ? narration : { output: [narration] };
}

// 和真实模型对齐：提取层模式下主叙事只回散文正文，用例给的 { output } 按行摊成散文。
function shapeFor(record, response) {
  if (record.narrativeOnly && Array.isArray(response?.output) && !response.choices) return response.output.join("\n");
  return response;
}

function payloadFor(response) {
  if (response?.choices) return response;
  return {
    choices: [{ index: 0, message: { role: "assistant", content: textFrom(response) }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

export async function installMockAi(page, { responses } = {}) {
  const requests = [];
  const holds = [];
  const nextResponses = [];
  const responseList = Array.isArray(responses) ? [...responses] : [];
  const responseMap = responses && !Array.isArray(responses) && typeof responses === "object" ? responses : {};
  let defaultFn = typeof responses === "function" ? responses : defaultResponse;

  function hold({ kind = "main" } = {}) {
    let arrive;
    let continueRequest;
    const arrived = new Promise((resolve) => { arrive = resolve; });
    const gate = {
      kind,
      state: "armed",
      claimed: false,
      request: null,
      wait: () => arrived,
      release(response) {
        if (!["armed", "held"].includes(this.state)) return;
        this.state = "released";
        this.response = response;
        continueRequest?.({ response });
      },
      fail(error = new Error("Mock AI request failed")) {
        if (!["armed", "held"].includes(this.state)) return;
        this.state = "failed";
        this.error = error instanceof Error ? error : new Error(String(error));
        continueRequest?.({ error: this.error });
      },
      attach(resolve) {
        continueRequest = resolve;
        if (this.state === "released") resolve({ response: this.response });
        if (this.state === "failed") resolve({ error: this.error });
      },
      arrive(record) {
        this.request = record;
        this.state = this.state === "armed" ? "held" : this.state;
        arrive(record);
      },
    };
    holds.push(gate);
    return gate;
  }

  function next(response, { kind = "main" } = {}) {
    nextResponses.push({ response, kind });
  }

  function setDefault(fn) {
    if (typeof fn !== "function") throw new TypeError("setDefault expects a function");
    defaultFn = fn;
  }

  await page.route("**/__qa_ai/**", async (route) => {
    const request = route.request();
    let body = {};
    try {
      body = request.postDataJSON() || {};
    } catch {
      body = {};
    }
    const prompt = (body.messages || []).map((message) => message.content || "").join("\n");
    const kind = prompt.includes("地图预跑员") ? "prerun" : prompt.includes("游戏状态提取器") ? "extraction" : "main";
    const record = {
      id: requests.length + 1,
      kind,
      narrativeOnly: kind === "main" && /直接续写正文|直接输出叙事(散文)?正文/.test(prompt),
      url: request.url(),
      body,
      startedAt: Date.now(),
      held: false,
      done: false,
    };
    requests.push(record);

    let override;
    let failed;
    const gate = holds.find((candidate) => candidate.kind === kind && !candidate.claimed);
    if (gate) {
      gate.claimed = true;
      record.held = true;
      gate.arrive(record);
      const result = await new Promise((resolve) => gate.attach(resolve));
      override = result.response;
      failed = result.error;
    }

    if (failed) {
      record.error = failed.message;
      record.done = true;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: failed.message } }) });
      return;
    }

    const queued = nextResponses.findIndex((entry) => entry.kind === kind);
    if (override === undefined && queued >= 0) override = nextResponses.splice(queued, 1)[0].response;
    if (override === undefined && responseList.length) override = responseList.shift();
    if (override === undefined && responseMap[kind] !== undefined) override = responseMap[kind];
    const response = shapeFor(record, override === undefined ? await defaultFn(record) : override);
    record.response = response;
    record.done = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payloadFor(response)) });
  });

  return { hold, next, requests, setDefault };
}
