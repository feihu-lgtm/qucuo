// 设置面板各 tab 共用的本地文件读写小工具（原 SettingsPanel.jsx 内联函数）。
export const ts = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

// 通用：把一段文本下载成本地文件（落盘）。
export const downloadText = (filename, text) => {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// 通用：让用户选一个本地文件，读出文本回调。
export const pickTextFile = (onText) => {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "application/json,.json,text/plain";
  inp.onchange = () => {
    const file = inp.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onText(String(reader.result || ""));
    reader.onerror = () => alert("读取文件失败。");
    reader.readAsText(file);
  };
  inp.click();
};
