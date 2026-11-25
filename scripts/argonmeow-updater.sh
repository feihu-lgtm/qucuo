#!/usr/bin/env bash
# argonmeow.online/qucuo 服务器侧自动更新器。
# 安装：复制到服务器 ~/argonmeow-qucuo-updater.sh，chmod +x，再用 systemd timer 每分钟执行。
# 语义：轮询 GitHub main； commit 或远端 manifest 不一致才重建。构建前强制刷新版本戳，
# 部署后校验 manifest/argon-config/首页/资产，失败自动回滚到备份目录。
set -euo pipefail

REPO_URL="https://github.com/feihu-lgtm/qucuo.git"
SRC="$HOME/argonmeow-qucuo-src"
TARGET="/srv/argonmeow-qucuo"
LOCK="/tmp/argonmeow-qucuo-updater.lock"
REJECTED="$HOME/argonmeow-qucuo.rejected"

exec 9>"$LOCK"
flock -n 9 || exit 0

# 上次若在“旧目录已挪开、新目录未换上”的窄窗口中断，先自愈出可访问站点，
# 否则后续每次都会在备份步骤因 TARGET 不存在而失败。
if [ ! -d "$TARGET" ]; then
  latest_backup="$(ls -1dt /srv/argonmeow-qucuo.bak.* 2>/dev/null | head -1 || true)"
  if [ -n "$latest_backup" ]; then
    sudo -n mv "$latest_backup" "$TARGET" || true
  fi
fi

if [ ! -d "$SRC/.git" ]; then
  rm -rf "$SRC"
  git clone --depth 50 "$REPO_URL" "$SRC"
fi
cd "$SRC"
git fetch --depth 50 origin main
remote="$(git rev-parse origin/main)"
local="$(git rev-parse HEAD 2>/dev/null || echo none)"

if [ "$local" = "$remote" ] && curl -fsS --max-time 10 https://argonmeow.online/qucuo/deploy-manifest.json 2>/dev/null | grep -q "\"commit\":\"$remote\""; then
  exit 0
fi

# 验证失败并已回滚的 commit 不再每分钟反复发布；人工删除记录行才会重试。
if grep -qx "$remote" "$REJECTED" 2>/dev/null; then
  echo "[qucuo-updater] skipping rejected $remote"
  exit 0
fi

echo "[qucuo-updater] deploying $remote"
git reset --hard origin/main >/dev/null
# 首次安装时仓库可能还没有这三个脚本（它们正随本更新程序入场）；
# 允许从 ~/qucuo-deploy-tools/ 做一次性引导。入库后永远优先用仓库内版本。
for tool in stampDeployVersion.mjs writeDeployManifest.mjs verifyArgonDeployment.mjs; do
  if [ ! -f "scripts/$tool" ] && [ -f "$HOME/qucuo-deploy-tools/$tool" ]; then
    cp "$HOME/qucuo-deploy-tools/$tool" "scripts/$tool"
  fi
done
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci --no-audit --no-fund
fi
node scripts/stampDeployVersion.mjs
DEPLOY_BASE=/qucuo/ npm run build
node scripts/writeDeployManifest.mjs "$remote"
cat > dist/argon-config.json <<'JSON'
{"provider":"custom","apiType":"openai","endpoint":"https://argonmeow.online/api/qucuo/v1/chat/completions","model":"gemini-3.8-flash"}
JSON

stage="$HOME/argonmeow-qucuo.new.$remote"
rm -rf "$stage"
mv dist "$stage"
ts="$(date +%Y%m%d%H%M%S)"
backup="/srv/argonmeow-qucuo.bak.$ts"
if sudo -n mv "$TARGET" "$backup"; then
  if sudo -n mv "$stage" "$TARGET"; then
    sudo -n chown -R admin:admin "$TARGET"
  else
    sudo -n mv "$backup" "$TARGET" || true
    echo "[qucuo-updater] move-in failed; rolled back" >&2
    exit 1
  fi
else
  echo "[qucuo-updater] backup move failed" >&2
  exit 1
fi

ok=0
for _ in 1 2 3 4 5; do
  if node scripts/verifyArgonDeployment.mjs https://argonmeow.online/qucuo/ "$remote"; then
    ok=1
    break
  fi
  sleep 2
done
if [ "$ok" != 1 ]; then
  echo "[qucuo-updater] verification failed; rolling back" >&2
  echo "$remote" >> "$REJECTED"
  sudo -n rm -rf "$TARGET.failed.$ts" || true
  sudo -n mv "$TARGET" "$TARGET.failed.$ts" || true
  sudo -n mv "$backup" "$TARGET" || true
  exit 1
fi

# 只保留最近 5 份成功备份/失败现场，避免每次发版复制整站最终填满磁盘。
ls -1dt /srv/argonmeow-qucuo.bak.* 2>/dev/null | tail -n +6 | xargs -r -n1 sudo -n rm -rf
ls -1dt /srv/argonmeow-qucuo.failed.* 2>/dev/null | tail -n +6 | xargs -r -n1 sudo -n rm -rf

echo "[qucuo-updater] deployed $remote backup=$backup"
