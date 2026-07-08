"use client";
import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[VAAKYA ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          background: "#12111E",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 16,
          padding: "2rem",
          textAlign: "center",
          color: "#EF4444",
        }}>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 13, color: "#A09DB8", marginBottom: 16 }}>
            {this.state.error?.message ?? "Unexpected error"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              background: "#8B5CF6",
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 20px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}