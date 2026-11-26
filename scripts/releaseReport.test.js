// B0：releaseReport 阈值评估退出码 + chain 分列 + 旧行归并 judge
import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mk = (data) => {
  const dir = mkdtempSync(join(tmpdir(), "rr-"));
  const fp = join(dir, "m.json");
  writeFileSync(fp, JSON.stringify(data));
  return { dir, fp };
};
const run = (fp) => {
  try {
    const out = execSync(`node scripts/releaseReport.mjs ${fp}`, { encoding: "utf8", cwd: process.cwd() });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: String(e.stdout || "") };
  }
};
const sealRow = (over = {}) => ({ provider: "custom", model: "m1", total: 100, withSeal: 100, missingSeal: 0, jsonOk: 100, jsonFailed: 0, passed: 99, failed: 1, ...over });
const intakeRow = (over = {}) => ({ provider: "custom", model: "m1", calls: 100, schemaOk: 99, parseFailed: 0, validateFailed: 1, otherFailed: 0, ...over });

describe("releaseReport 阈值评估", () => {
  it("全过：exit 0", () => {
    const { dir, fp } = mk({ version: 2, cumulative: { intake: [intakeRow()], seal: [sealRow({ chain: "judge" }), sealRow({ chain: "group" })] } });
    const r = run(fp);
    expect(r.code).toBe(0);
    expect(r.out).toContain("全部通过");
    rmSync(dir, { recursive: true, force: true });
  });
  it("群聊尾章低于 98%：exit 2 且指明群聊", () => {
    const { dir, fp } = mk({ version: 2, cumulative: { intake: [intakeRow()], seal: [sealRow({ chain: "judge" }), sealRow({ chain: "group", passed: 90, failed: 10 })] } });
    const r = run(fp);
    expect(r.code).toBe(2);
    expect(r.out).toContain("群聊尾章合格率");
    rmSync(dir, { recursive: true, force: true });
  });
  it("intake schema 98% 以下/其他失败压调用成功率：exit 2", () => {
    const { dir, fp } = mk({ version: 2, cumulative: { intake: [intakeRow({ schemaOk: 90 }), intakeRow({ provider: "p2", otherFailed: 5 })], seal: [] } });
    const r = run(fp);
    expect(r.code).toBe(2);
    expect(r.out).toContain("intake schema 合格率");
    expect(r.out).toContain("intake 调用成功率");
    rmSync(dir, { recursive: true, force: true });
  });
  it("旧行无 chain 归并 judge 不误伤群聊", () => {
    const { dir, fp } = mk({ version: 2, cumulative: { intake: [intakeRow()], seal: [sealRow({ passed: 99 }), sealRow({ chain: "group", total: 5, passed: 5 })] } });
    const r = run(fp);
    expect(r.code).toBe(0); // 99% judge 过线+群聊足额；旧行归并 judge 不进 group 桶
    rmSync(dir, { recursive: true, force: true });
  });

  it("无样本不能算过线：空数据 exit 2", () => {
    const { dir, fp } = mk({ version: 2, cumulative: { intake: [], seal: [] } });
    const r = run(fp);
    expect(r.code).toBe(2);
    expect(r.out).toContain("没测不能算过线");
    rmSync(dir, { recursive: true, force: true });
  });
  it("样本不足列 failure：intake 50 调用/judge 30 回合/group 2 回合", () => {
    const { dir, fp } = mk({ version: 2, cumulative: {
      intake: [intakeRow({ calls: 50, schemaOk: 50 })],
      seal: [sealRow({ chain: "judge", total: 30, passed: 30 }), sealRow({ chain: "group", total: 2, passed: 2 })],
    } });
    const r = run(fp);
    expect(r.code).toBe(2);
    expect(r.out).toContain("intake 样本不足");
    expect(r.out).toContain("判官尾章样本不足");
    expect(r.out).toContain("群聊尾章样本不足");
    rmSync(dir, { recursive: true, force: true });
  });
  it("足额全过：intake 100/judge 50/group 5 exit 0", () => {
    const { dir, fp } = mk({ version: 2, cumulative: {
      intake: [intakeRow()],
      seal: [sealRow({ chain: "judge", total: 50, passed: 50 }), sealRow({ chain: "group", total: 5, passed: 5 })],
    } });
    const r = run(fp);
    expect(r.code).toBe(0);
    rmSync(dir, { recursive: true, force: true });
  });
});
