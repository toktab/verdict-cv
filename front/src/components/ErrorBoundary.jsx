import { Component } from 'react';
import { RefreshCcw } from 'lucide-react';

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('VERDICT route failed', error, info);
    }

    render() {
        if (!this.state.error) {
            return this.props.children;
        }

        return (
            <div className="shell">
                <main className="errorBoundaryPage">
                    <section>
                        <span className="eyebrow">Recovery</span>
                        <h1>VERDICT hit a display problem.</h1>
                        <p>The current view failed, but your session and saved work are still available. Refresh the workspace to reload the route.</p>
                        <button className="primary" type="button" onClick={() => window.location.reload()}>
                            <RefreshCcw size={16} /> Reload workspace
                        </button>
                    </section>
                </main>
            </div>
        );
    }
}
