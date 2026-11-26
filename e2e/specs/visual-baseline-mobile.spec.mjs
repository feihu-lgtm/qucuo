import { captureBaseline } from "../harness/visualBaseline.mjs";

export const viewport = { width: 390, height: 844 };

export default async function visualBaselineMobile(ctx) {
  const report = await captureBaseline(ctx, "mobile");
  if (report.skipped.length) console.warn("[visual-baseline mobile] 跳过：", report.skipped);
}
