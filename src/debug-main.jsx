// 调试前端入口。独立于游戏主入口（main.jsx），走单独的 debug.html 页面，
// 不必经过开局界面，打开 /debug.html 直接就是调试台。
import React from "react";
import { createRoot } from "react-dom/client";
import DebugConsole from "./debugConsole.jsx";

createRoot(document.getElementById("debug-root")).render(<DebugConsole />);
