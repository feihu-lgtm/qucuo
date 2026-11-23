// 追踪端口兼容壳：engine/ui 已直连 infra/actionTrace，本文件仅剩 app/hooks
// 四处引用（Worker 3 边界外），hooks 改口后即可删除。
export * from "../../infra/actionTrace.js";
