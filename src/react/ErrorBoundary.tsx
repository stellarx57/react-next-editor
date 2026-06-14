'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Wraps the editor so a failure in one feature/instance cannot bring down the
 * host app (F-11.2). Degrades to a recoverable state with a clear message and a
 * retry button; reports the error via `onError` for monitoring (F-11.8).
 */
export class EditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[react-next-editor] Editor error contained by boundary:', error, info);
    this.props.onError?.(error);
  }

  private readonly handleReset = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="rne-root">
          <div className="rne-error" role="alert">
            <strong>{this.props.fallbackMessage ?? 'The editor encountered a problem.'}</strong>
            <p>Your latest saved content is preserved locally. You can try to recover the editor.</p>
            <button type="button" onClick={this.handleReset}>
              Reload editor
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
