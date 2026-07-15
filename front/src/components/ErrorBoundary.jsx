import { Component } from 'react';
import { ArrowRight, LayoutDashboard, LogOut, RefreshCcw } from 'lucide-react';

export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null, resetKey: props.resetKey };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    static getDerivedStateFromProps(props, state) {
        if (props.resetKey !== state.resetKey) {
            return { error: null, resetKey: props.resetKey };
        }
        return null;
    }

    componentDidCatch(error, info) {
        console.error('VERDICT route failed', error, info);
    }

    recover(action) {
        this.setState({ error: null }, () => {
            if (typeof action !== 'function') return;
            Promise.resolve(action()).catch((error) => {
                console.error('VERDICT recovery action failed', error);
                this.setState({ error });
            });
        });
    }

    render() {
        if (!this.state.error) {
            return this.props.children;
        }

        const routeLabel = this.props.route ? `The ${this.props.route} view failed, but your session and saved work are still available.` : 'The current view failed, but your session and saved work are still available.';

        return (
            <div className="shell">
                <main className="errorBoundaryPage">
                    <section>
                        <span className="eyebrow">Recovery</span>
                        <h1>VERDICT hit a display problem.</h1>
                        <p>{routeLabel} Choose a safe place to continue, or reload this route if you were in the middle of something.</p>
                        <div className="routeRecoveryActions">
                            <button className="primary" type="button" onClick={() => this.recover(this.props.onDashboard)}>
                                <LayoutDashboard size={16} /> Dashboard
                            </button>
                            <button className="secondary" type="button" onClick={() => this.recover(this.props.onProjects)}>
                                <ArrowRight size={16} /> Projects
                            </button>
                            <button className="secondary" type="button" onClick={() => window.location.reload()}>
                                <RefreshCcw size={16} /> Reload route
                            </button>
                            <button className="quiet" type="button" onClick={() => this.recover(this.props.onLogout)}>
                                <LogOut size={16} /> Logout
                            </button>
                        </div>
                    </section>
                </main>
            </div>
        );
    }
}
