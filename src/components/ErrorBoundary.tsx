import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-error-container rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-error" />
            </div>
            <h2 className="text-xl font-bold text-on-surface mb-2">
              Đã xảy ra lỗi
            </h2>
            <p className="text-sm text-on-surface-variant mb-6">
              Ứng dụng gặp lỗi không mong muốn. Vui lòng thử tải lại trang.
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
