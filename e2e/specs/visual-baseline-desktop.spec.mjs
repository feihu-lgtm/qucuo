import { captureBaseline } from "../harness/visualBaseline.mjs";

export const viewport = { width: 1440, height: 900 };

export default async function visualBaselineDesktop(ctx) {
  const report = await captureBaseline(ctx, "desktop");
  if (report.skipped.length) console.warn("[visual-baseline desktop] 跳过：", report.skipped);
}
