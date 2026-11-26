# src/copy —— 提示词与长文案单源目录

图纸/审查钦定的提示词与长文案住在这里，一个文件一段文案，正文逐字粘贴原文，一行注释都别加进正文。

代码里用 Vite 的 `?raw` 原样引入：

```js
import { loadCopy } from "./copy/loadCopy.js";
const ROAM_REACTION_SYS = loadCopy("roamReaction.sys.txt");
```

（不要直接 `import txt from "./x.txt?raw"`——vite/vitest 能吃，但纯 node 门禁脚本会崩；loadCopy 同构封装两头通吃。）

铁律：
- 逐字即权威——外部图纸给什么就粘什么，删一个字 `copy-gate` 不说但天理不容；改动走 PR diff 可见。
- 新增长文案（>200 字符中文为主）禁止内联进 js，违者 `npm run copy-gate` 失败。
