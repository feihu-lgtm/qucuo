#!/bin/bash
cd "$(dirname "$0")"
echo "正在启动曲措乡……"
if [ ! -d node_modules ]; then
  echo "首次运行，安装依赖中（只需一次）……"
  npm install
fi
# 用 vite --open：Vite 会在自己最终选定的端口（5171，被占则自动 5172、5173…）
# 上启动，并自动用那个真实端口打开浏览器——不再写死端口，换端口也能打开对的地址。
npm run dev -- --open
