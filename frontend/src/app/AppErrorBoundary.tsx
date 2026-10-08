import { Component, createRef, type ReactNode } from "react";
import "./app-error.css";

export default class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  private notice = createRef<HTMLElement>();

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.notice.current?.focus();
  }

  render() {
    if (!this.state.failed) return this.props.children;

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
