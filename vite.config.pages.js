// GitHub Pages 专用构建配置：只打包游戏主入口 index.html（不含调试页），
// base 固定为 /qucuo/ 以适配 https://feihu-lgtm.github.io/qucuo/ 子路径。
// 用法：npx vite build --config vite.config.pages.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/qucuo/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
