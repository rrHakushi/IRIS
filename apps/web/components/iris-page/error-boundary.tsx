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

export class IrisErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[IrisPage ErrorBoundary] Error in <${this.props.fallbackNodeName || "Node"}>:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive font-mono my-1 inline-block">
          <div className="font-semibold flex items-center gap-1.5">
            <span>⚠️ Error rendering &lt;{this.props.fallbackNodeName || "Node"}&gt;</span>
          </div>
          <div className="text-[10px] opacity-80 mt-0.5">{this.state.error?.message || "Unknown rendering error"}</div>
        </div>
      )
    }

    return this.props.children
  }
}
