import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("PriceTrack error boundary caught an error", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="glass-accented max-w-lg rounded-2xl p-6 text-center shadow-[var(--glass-shadow-lg)]">
          <h1 className="text-2xl font-semibold text-foreground">Algo ha fallado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No se ha podido renderizar esta vista. Recarga la aplicación para intentarlo de nuevo.
          </p>
          {this.state.error?.message && <p className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">{this.state.error.message}</p>}
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Recargar
          </Button>
        </div>
      </div>
    );
  }
}
