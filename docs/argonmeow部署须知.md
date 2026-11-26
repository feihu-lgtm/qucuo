# argonmeow 部署须知

> A2 起生产只跟 `release` 分支，资源合并部署只增不删。本须知面向运维：静态服务必须配合以下语义，否则旧页面会加载不到分块。

## 三条硬要求

1. **`/qucuo/assets/` 下缺失的文件返回 404，不回退到首页。**
   SPA 惯用的 `try_files $uri /index.html` 回退必须排除 `assets/` 路径——分块缺失时返回 HTML 会让浏览器把 HTML 当 JS 解析，报奇怪的语法错误，而且 `vite:preloadError` 兜底捕获不到。404 才能被正确识别为分块缺失。
2. **带哈希的资源设长缓存。**
   `assets/` 下文件名带内容哈希，内容不可变，应设 `Cache-Control: public, max-age=31536000, immutable`。
3. **`index.html` 设 `no-cache`。**
   入口 HTML 必须每次重验证，否则客户端永远捏着旧分块清单，发版不生效。`Cache-Control: no-cache`（或 `no-store`），不要设长缓存。

## Nginx 示例

```nginx
location /qucuo/assets/ {
    # 缺失即 404：不带 try_files 回退。
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location = /qucuo/index.html {
    add_header Cache-Control "no-cache";
}

location /qucuo/ {
    # 其余路径（SPA 路由）可回退首页，但 assets 已被上面截走。
    try_files $uri /qucuo/index.html;
}
```

## 服务器实际是 Caddy 时的对应关系

Caddyfile 没有 `try_files` 字面指令，用 `file_server` + `rewrite` 组合表达同一语义：

```caddyfile
handle /qucuo/assets/* {
    # file_server 默认缺失即 404，无回退——符合要求一，无需额外配置。
    header Cache-Control "public, max-age=31536000, immutable"
    file_server
}

handle /qucuo/index.html {
    header Cache-Control "no-cache"
    file_server
}

handle /qucuo/* {
    # SPA 回退只兜非 assets 路径（assets 已被上面 handle 截走，不会到这里）。
    try_files {path} /qucuo/index.html
    file_server
}
```

要点与 Nginx 版完全一致：assets 缺失必须 404（Caddy `file_server` 默认即如此，**不要**对它的 404 做错误页回退）；哈希资源长缓存；`index.html` no-cache。

## assets 与 public 静态资源不是同类缓存语义

- `/qucuo/assets/`：vite 产物，文件名带内容哈希——长缓存 immutable，清理按 manifest 引用裁决。
- `/qucuo/` 根下的 `stones/`、`portraits/`、`fonts/`、`music/`、`bidders/` 等 public 静态目录：**不是**哈希资产，文件名不变内容会变——**不得设 immutable 长缓存**（用默认或短缓存，依赖浏览器重验证）；部署时同名覆盖合并但只增不删，清理脚本不碰它们。

## 发版语义速查

- updater 每分钟轮询 `release` 分支（不再跟 main）。
- 新构建 `assets/` 合并进现有 `assets/`：只增不删。
- `index.html`/`deploy-manifest.json`/`argon-config.json` 原子替换（同目录临时文件 + mv）。
- 清理只删 7 天前、且不被最近三版 manifest 引用的资源（`scripts/cleanupArgonAssets.mjs`）。
- 客户端 `vite:preloadError` 兜底：30 秒内最多自动刷新一次，刷新前尽力自动存档；存储不可用只提示手动刷新。
