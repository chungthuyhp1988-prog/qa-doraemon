import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null, showDetails: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Log to console / observability service
    console.error("ErrorBoundary caught an uncaught exception:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
          <div className="text-center max-w-md w-full">
            <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-error" />
            </div>
            <h2 className="text-xl font-bold text-on-surface mb-2">
              Đã xảy ra lỗi hệ thống
            </h2>
            <p className="text-sm text-on-surface-variant mb-6">
              Ứng dụng gặp sự cố không mong muốn. Vui lòng tải lại trang hoặc thử lại sau.
            </p>
            
            <div className="flex justify-center gap-3 mb-6">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm hover:shadow cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Tải lại trang
              </button>
              
              {this.state.error && (
                <button
                  onClick={this.toggleDetails}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-outline-variant hover:bg-surface-container rounded-xl font-semibold text-sm text-on-surface-variant transition-all cursor-pointer"
                >
                  {this.state.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Chi tiết lỗi
                </button>
              )}
            </div>

            {/* Error details details */}
            {this.state.showDetails && this.state.error && (
              <div className="text-left bg-surface-container border border-outline-variant/60 rounded-2xl p-4 overflow-auto max-w-lg max-h-[300px] text-xs font-mono text-error leading-relaxed animate-in fade-in duration-200">
                <div className="font-bold border-b border-outline-variant/30 pb-2 mb-2">
                  Error: {this.state.error.toString()}
                </div>
                <div className="whitespace-pre-wrap select-all">
                  {this.state.error.stack}
                  {this.state.errorInfo && `\nComponent Stack:\n${this.state.errorInfo.componentStack}`}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
