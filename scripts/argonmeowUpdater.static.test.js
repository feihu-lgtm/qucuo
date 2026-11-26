// A2 初审修静态验证：updater 备份失败路径 hard fail 且不碰 TARGET；release refspec；目录并入。
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./argonmeow-updater.sh", import.meta.url), "utf8");

describe("argonmeow-updater 关键路径静态断言", () => {
  it("备份失败 hard fail：exit 出现在任何 TARGET 写入之前", () => {
    const backupIdx = src.indexOf("backup copy failed; aborting");
    expect(backupIdx).toBeGreaterThan(-1);
    // 备份失败分支必须 exit 1
    const branch = src.slice(backupIdx, backupIdx + 400);
    expect(branch).toContain("exit 1");
    // 备份块必须出现在 assets 合并写入之前
    const mergeIdx = src.indexOf('cp -a "$stage/assets/." "$TARGET/assets/"');
    expect(mergeIdx).toBeGreaterThan(backupIdx);
  });
  it("shallow clone 显式 refspec 拉 release", () => {
    expect(src).toContain("+release:refs/remotes/origin/release");
    expect(src).toContain("--branch release");
    expect(src).not.toContain("git fetch --depth 50 origin main");
  });
  it("静态目录并入（不只 -f 文件）", () => {
    expect(src).toContain('cp -a "$entry/." "$TARGET/$base/"');
  });
  it("三入口文件原子替换（临时文件+mv）", () => {
    expect(src).toMatch(/tmpf=.*\.new\./);
    expect(src).toContain('mv "$tmpf" "$TARGET/$f"');
  });
});
