#!/usr/bin/env bash
# 跨模块导出检查
# =============================================================================
# 【为什么需要这个】改完代码只跑单文件语法检查（esbuild 逐个 transform，或编辑器
# 报错）看不出跨模块的问题：A 文件 import 了 B 文件没有导出的名字，两个文件各自
# 语法都完全合法，只有真正打包时才会炸。
#
# 这个坑真实发生过两次，都是同一个根因——用不带校验的字符串替换改文件，锚点对不上
# 就静默空转，然后误以为改成功了：
#   · SettingsPanel 的入册卡片：replace 没匹配，print 却报了成功
#   · importedRegistry 的待用主角卡三函数：消费侧（CharacterCreate 三处读、
#     main.jsx 一处写）提交了，生产侧压根没进去。vitest 全绿 642/643，因为
#     没有一条测试 import CharacterCreate；只有 CI 的 vite build 抓到
#     "getPendingPlayerCard is not exported by importedRegistry.js"。
#
# 【定位】这不是 npm run verify 的替代品。装了 node_modules 就直接跑 verify，
# 它含 vitest 全量 + pages 构建，比这个全。这个脚本是给没装依赖的环境用的应急检查
# （只需要一个全局 esbuild），专门抓「导出缺失 / 路径写错 / 循环引用」这类
# 单文件检查看不见的问题。
#
# 用法：bash scripts/bundleCheck.sh
# 退出码 0 = 所有相对 import 都解析得通

set -uo pipefail
cd "$(dirname "$0")/.."

if ! command -v esbuild >/dev/null 2>&1; then
  echo "需要 esbuild。装了 node_modules 的话请直接跑 npm run verify（更全）。"
  echo "只想跑这个检查：npm i -g esbuild"
  exit 2
fi

# --packages=external 把 node_modules 里的包全部外部化，不需要真的装依赖，
# 只解析项目内的相对路径 import——正好是我们要查的部分。
# 各类资源要配 loader，否则会先在 .webp/.css 上失败，掩盖真正的导出错误。
OUT=$(esbuild src/main.jsx \
  --bundle --outfile=/dev/null --packages=external \
  --loader:.js=jsx \
  --loader:.webp=dataurl --loader:.png=dataurl --loader:.jpg=dataurl \
  --loader:.svg=dataurl --loader:.css=css \
  --loader:.mp3=dataurl --loader:.ogg=dataurl --loader:.wav=dataurl \
  --log-limit=0 2>&1)
CODE=$?

# 只把 ERROR 当失败。warning 多是 sourcemap、注解之类，不拦。
ERRS=$(printf '%s\n' "$OUT" | grep -c '✘ \[ERROR\]' || true)

if [ "$CODE" -eq 0 ] && [ "$ERRS" -eq 0 ]; then
  MODS=$(printf '%s\n' "$OUT" | grep -oE '[0-9]+ modules' | tail -1)
  echo "✓ 跨模块 import 全部解析通过 ${MODS:+（$MODS）}"
  exit 0
fi

echo "✗ 发现 $ERRS 处错误："
printf '%s\n' "$OUT" | grep -A 4 '✘ \[ERROR\]'
exit 1
