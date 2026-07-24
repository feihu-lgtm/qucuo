# 曲措乡 · Qucuo

一款浏览器端的中文武侠文字 MUD RPG。设定在藏地风格的高原山乡，融合 AI 驱动叙事、回合制战斗、NPC 交互与固定拓扑地图，纯前端运行（React + Vite），无需后端。

## 设计核心

- **AI 提议，系统裁决** —— AI 从不直接修改游戏状态，所有数值与拓扑结果由确定性代码决定，AI 只负责生成描述文本。
- **契诃夫之枪** —— 无装饰性元素，每个物品、NPC、房间都服务于后续的机制或叙事。
- **固定世界拓扑** —— 地图节点预设，AI 不创造新地点。
- **说书人叙事** —— 全知单一叙述者，好感度只调整文风，不拆分人格。
- **世界不把玩家当特殊人物**（Kenshi 式设计）。

## 技术栈

- 前端：React / Vite，浏览器端运行
- AI 接口：Anthropic (Claude)、Gemini、OpenAI 兼容端点
- 记忆系统：bge-m3 向量嵌入 + IndexedDB，强/弱双档召回
- 参考：SillyTavern 架构、北大侠客行 MUD 机制

## 快速开始

```bash
npm install       # 安装依赖
npm run dev       # 本地开发服务器
npm run build     # 构建生产版本
```

也可直接双击 `启动游戏.command`（macOS）或 `启动游戏.bat`（Windows）一键运行。

首次运行需在设置面板填入 AI API 密钥（Anthropic / Gemini / OpenAI 兼容任选其一）。

## 目录结构

```
qucuo/
├── src/                      # 源代码
│   ├── MudRPG.jsx            # 主游戏组件
│   ├── main.jsx              # 入口
│   ├── narrator.js           # 说书人叙事引擎
│   ├── knowledge.js          # 知识/情报传播系统（确定性演化）
│   ├── mvu.js                # 动态变量树（好感度追踪）
│   ├── qucuoMap.js           # 固定地图拓扑
│   ├── worldbook.js          # 世界观设定书
│   ├── combat/               # 回合制战斗（AI决策、招式、状态、偷窃）
│   ├── memory/               # 向量记忆（嵌入、召回、日结）
│   ├── quests/               # 任务系统（引擎、脚本、结局判定）
│   ├── buildings/            # 建筑交互界面（武馆、当铺、茶楼、赌石等）
│   ├── shops/                # 商店系统
│   ├── items/                # 物品目录与分布
│   ├── kungfu/               # 武学系统
│   ├── presets/              # SillyTavern 兼容预设
│   ├── utils/                # 工具（buff、种子随机）
│   └── assets/portraits/     # NPC 立绘
├── public/                   # 静态资源（赌石卡牌、立绘、UI素材）
├── docs/                     # 设计文档
│   ├── 曲措乡_总纲_v3.md      # 项目总纲
│   ├── _交接总纲_从这里开始.md # 交接入口
│   └── ...                   # 各系统设计文档
├── dist/                     # 构建产物
├── index.html
├── vite.config.js
├── package.json
├── 启动游戏.command          # macOS 一键启动
└── 启动游戏.bat              # Windows 一键启动
```

## 文档

设计文档集中在 `docs/`，建议从 `docs/_交接总纲_从这里开始.md` 与 `docs/曲措乡_总纲_v3.md` 入手。
