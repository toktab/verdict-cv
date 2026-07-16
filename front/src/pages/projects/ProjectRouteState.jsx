import { ArrowRight, Home, RefreshCcw } from 'lucide-react';

export function ProjectRouteState({
    Header,
    setRoute,
    user,
    userToken,
    setUser,
    setUserToken,
    navigateTo,
    loading = false,
    eyebrow = 'Route error',
    title = 'Error',
    message = "You're trying to reach a page that doesn't exist or doesn't exist anymore.",
    retryLabel = '',
    onRetry,
}) {
    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="workspace contentFadeIn">
                <section className="routeStatePanel">
                    <span className="eyebrow">{loading ? 'Loading' : eyebrow}</span>
                    <h1>{loading ? 'Loading workspace...' : title}</h1>
                    <p>{loading ? 'VERDICT is loading your saved projects and route data.' : message}</p>
                    <div className="routeStateActions">
                        {!loading && onRetry && (
                            <button className="primary" type="button" onClick={onRetry}>
                                <RefreshCcw size={16} /> {retryLabel || 'Retry'}
                            </button>
                        )}
                        {loading ? (
                            <button className="secondary" type="button" onClick={() => window.location.reload()}>
                                <RefreshCcw size={16} /> Reload
                            </button>
                        ) : (
                            <>
                                <button className={onRetry ? 'secondary' : 'primary'} type="button" onClick={() => navigateTo(setRoute, 'home')}>
                                    <Home size={16} /> Home
                                </button>
                                <button className="secondary" type="button" onClick={() => navigateTo(setRoute, 'projects')}>
                                    <ArrowRight size={16} /> All projects
                                </button>
                            </>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
