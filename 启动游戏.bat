@echo off
cd /d "%~dp0"
chcp 65001 >nul
echo 正在启动曲措乡……
if not exist node_modules (
  echo 首次运行，安装依赖中（只需一次）……
  call npm install
)
rem 用 vite --open：Vite 在自己最终选定的端口（5171，被占则自动 5172、5173…）启动，
rem 并用那个真实端口自动打开浏览器——不再写死端口、不再在服务器起来前就开浏览器。
call npm run dev -- --open
pause
