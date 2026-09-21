"use client"

import * as React from "react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackNodeName?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class IrisErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[IrisPage ErrorBoundary] Error in <${this.props.fallbackNodeName || "Node"}>:`,
      error,
      errorInfo
    )
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="my-1 inline-block rounded-xl border border-destructive/40 bg-destructive/10 p-2 font-mono text-xs text-destructive">
          <div className="flex items-center gap-1.5 font-semibold">
            <span>
              ⚠️ Error rendering &lt;{this.props.fallbackNodeName || "Node"}&gt;
            </span>
          </div>
          <div className="mt-0.5 text-[10px] opacity-80">
            {this.state.error?.message || "Unknown rendering error"}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
