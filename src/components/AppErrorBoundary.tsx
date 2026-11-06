import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  onReturn?: () => void;
};

type State = {
  error: Error | null;
};

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("DocSpace failed to render:", error, info.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
          <section className="w-full max-w-lg rounded-2xl border border-border bg-white p-7 shadow-card" role="alert">
            <h1 className="text-xl font-extrabold text-text-primary">This view couldn’t be displayed</h1>
            <p className="mt-2 text-sm text-text-secondary">
              Your saved documents are still on the server. Return to the workspace or reload this view.
            </p>
            {import.meta.env.DEV && (
              <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-3 text-xs text-error">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {this.props.onReturn && (
                <button onClick={this.props.onReturn} className="btn-primary rounded-xl px-4 py-2.5 text-sm font-bold">
                  Back to documents
                </button>
              )}
              <button onClick={() => this.setState({ error: null })} className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-semibold">
                Try again
              </button>
              <button onClick={() => window.location.reload()} className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-semibold">
                Reload workspace
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
