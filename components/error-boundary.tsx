'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Global error boundary. Catches render-time exceptions in any child
 * subtree and shows a friendly fallback instead of a white screen.
 *
 * Wraps the app in components/providers.tsx so every page is protected.
 * Per-page boundaries can override by importing this directly.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="m-card border-[rgba(239,75,75,0.4)] bg-[rgba(239,75,75,0.04)] space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="text-[var(--color-danger)] shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold">Something went wrong on this page</div>
              <div className="text-xs text-muted mt-1">
                The rest of the app is still working. Try reloading the page, or
                go back and try a different action.
              </div>
              <details className="text-[10px] text-muted mt-2 font-mono">
                <summary className="cursor-pointer hover:text-[var(--color-foreground)]">
                  Show error
                </summary>
                <pre className="mt-1 p-2 rounded bg-[#0a0c10] overflow-auto whitespace-pre-wrap break-all">
                  {this.state.error?.message ?? 'Unknown error'}
                </pre>
              </details>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--color-accent)] text-[#2a1f0f] text-sm font-semibold"
            >
              <RefreshCw size={14} />
              Try again
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--color-card-border)] text-sm"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
