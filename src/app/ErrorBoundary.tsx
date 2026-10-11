import { Component, type ReactNode } from "react";
import f from "./Form.module.css";

/** A render crash in one screen should not blank the app: say what happened and how to recover. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert">
        <p className={f.error}>This screen hit a problem: {this.state.error.message}</p>
        <p className={f.note}>Your logged sets are safe. Reload to try again.</p>
        <button className={f.button} onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
