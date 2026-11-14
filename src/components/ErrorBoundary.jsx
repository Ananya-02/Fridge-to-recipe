import { Component } from 'react';

// Last line of defence: a render bug shows a friendly screen instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash" role="alert">
        <p className="crash-emoji" aria-hidden="true">🫠</p>
        <h1>Something boiled over</h1>
        <p>The page hit an unexpected error. Your saved recipes are safe.</p>
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
