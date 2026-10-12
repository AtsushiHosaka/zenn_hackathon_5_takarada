import { Component, createRef, type ReactNode } from "react";
import "./app-error.css";

export default class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; moduleLoadFailed: boolean }
> {
  state = { failed: false, moduleLoadFailed: false };
  private notice = createRef<HTMLElement>();
  private moduleNotice = createRef<HTMLElement>();
  private handleModuleLoadError = () => {
    // Nested viewer boundaries catch rejected imports, so listen globally as well.
    // Keep the current screen mounted until the user chooses to reload.
    this.setState({ moduleLoadFailed: true });
  };

  componentDidMount() {
    window.addEventListener("vite:preloadError", this.handleModuleLoadError);
  }

  componentWillUnmount() {
    window.removeEventListener("vite:preloadError", this.handleModuleLoadError);
  }

  componentDidUpdate(_previousProps: { children: ReactNode }, previousState: { failed: boolean; moduleLoadFailed: boolean }) {
    if (!previousState.moduleLoadFailed && this.state.moduleLoadFailed) {
      this.moduleNotice.current?.focus({ preventScroll: true });
    }
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.notice.current?.focus();
  }

  render() {
    if (!this.state.failed) return <>
      {this.props.children}
      {this.state.moduleLoadFailed && (
        <aside className="app-error-card app-load-error" ref={this.moduleNotice} tabIndex={-1} role="alert" aria-labelledby="app-load-error-title">
          <h2 id="app-load-error-title">画面の一部を読み込めませんでした</h2>
          <p>再読み込みして、もう一度お試しください。</p>
          <p>未保存の変更は失われることがあります。</p>
          <div className="app-error-actions">
            <button className="motion-control" type="button" onClick={() => window.location.reload()}>
              再読み込み
            </button>
          </div>
        </aside>
      )}
    </>;

    return (
      <main className="app-error" ref={this.notice} tabIndex={-1}>
        <section className="app-error-card motion-enter" role="alert" aria-labelledby="app-error-title">
          <h1 id="app-error-title">画面を表示できませんでした</h1>
          <p>再読み込みして、もう一度お試しください。</p>
          <p>未保存の変更は失われることがあります。</p>
          <div className="app-error-actions">
            <button className="motion-control" type="button" onClick={() => window.location.reload()}>
              再読み込み
            </button>
            <a className="motion-control" href="/rooms">部屋一覧に戻る</a>
          </div>
        </section>
      </main>
    );
  }
}
