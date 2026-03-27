"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-8">
          <div className="text-center space-y-4 max-w-sm">
            <div className="text-6xl">👷</div>
            <p className="text-lg font-semibold text-gray-800">
              Oops, something broke!
            </p>
            <p className="text-sm text-gray-500">Try refreshing the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-6 py-2 rounded-xl text-sm font-semibold transition-colors bg-brand-purple"
            >
              Reset
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
