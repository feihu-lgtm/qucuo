import React from "react";
import { buildDebugBundle, downloadDebugBundle } from "../../infra/debugBundle.js";
import { recordError } from "../../infra/errorBuffer.js";
import { getRngState } from "../../utils/rng.js";
import { CURRENT_VERSION } from "../../utils/version.js";

// 通用错误边界。任何被它包住的子组件在 render / 生命周期里抛错，
// 不再让整个 React 树白屏/黑屏，而是就地显示一段可读的错误信息 + 组件堆栈，
// 并提供一个"关闭"按钮把出错的界面收掉，让玩家能回到主界面而不是卡死。
//
// 为什么需要它：战斗界面(DuelScreen)这类复杂组件一旦在 render 阶段读到
// undefined 属性，错误发生在 React 渲染流程里，handleSelectMove 内部的
// try/catch 根本兜不到——那个 try 只保护事件处理，保护不了渲染。表现就是
// "点了某个按钮之后整块界面变黑、没有任何反馈"。有了错误边界，同样的崩溃
// 会变成一行明确的红字（含出错信息和是哪个组件哪一行），既不再黑屏，也
// 让排查有据可依。
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error, info) {
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
    this.props.onReset?.();
  };

  handleDownloadDebugBundle = () => {
    try {
      downloadDebugBundle(buildDebugBundle({ version: CURRENT_VERSION, rngState: getRngState }));
    } catch (error) {
      recordError(error, { source: "ErrorBoundary.debugBundle" });
    }
  };

  render() {
    if (this.state.hasError) {
      const msg = this.state.error?.message || String(this.state.error);
      const stack = this.state.info?.componentStack || this.state.error?.stack || "";
      return (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(10,12,20,0.96)", color: "var(--error-text)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: 24, fontFamily: "monospace", fontSize: 13, lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 16, color: "var(--error-title)", marginBottom: 12 }}>
            ⚠ {this.props.label || "界面"}出错了（已拦截，未黑屏）
          </div>
          <div style={{
            maxWidth: 640, background: "var(--ink-error-bg)", border: "1px solid var(--error-edge)",
            borderRadius: 0, padding: "10px 14px", marginBottom: 14, wordBreak: "break-word",
          }}>
            <div style={{ color: "var(--error-message)", marginBottom: 8 }}>{msg}</div>
            {stack && (
              <pre style={{
                whiteSpace: "pre-wrap", fontSize: 11, color: "var(--error-stack)",
                maxHeight: 220, overflowY: "auto", margin: 0,
              }}>{stack}</pre>
            )}
          </div>
          <div style={{ color: "var(--error-hint)", fontSize: 11, marginBottom: 14 }}>
            把上面这段错误发给作者，就能定位到具体是哪一行崩的。
          </div>
          <button type="button" onClick={this.handleDownloadDebugBundle} style={{
            cursor: "pointer", color: "var(--error-text)", padding: "6px 18px",
            border: "1px solid var(--error-button-edge)", background: "var(--ink-error-bg)", marginBottom: 10,
          }}>下载调试包</button>
          <span onClick={this.handleReset} style={{
            cursor: "pointer", color: "var(--clay)", padding: "6px 18px",
            border: "1px solid var(--accent)", borderRadius: 0, background: "var(--ink-tier-bg)",
          }}>关闭，返回</span>
        </div>
      );
    }
    return this.props.children;
  }
}
