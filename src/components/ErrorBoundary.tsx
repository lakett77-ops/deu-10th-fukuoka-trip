import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Trip app render error:", error, info);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-screen max-w-md items-center justify-center bg-white/70 px-6 py-12 text-center">
          <div className="rounded-2xl bg-white p-6 shadow-lg">
            <div className="text-lg font-bold text-slate-900">앱을 불러오지 못했어요</div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">
              {this.state.error.message}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
