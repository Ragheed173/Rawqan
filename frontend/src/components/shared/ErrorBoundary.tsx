import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/errorMonitor';
import { ErrorPage } from '@/pages/ErrorPage';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * App-level error boundary (Task 22). Catches render errors, forwards them to
 * the error monitor, and shows the 500 page instead of a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { componentStack: info.componentStack });
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) return <ErrorPage onReset={this.handleReset} />;
    return this.props.children;
  }
}
