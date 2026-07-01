import { ArrowRight, FolderPlus, RefreshCcw } from 'lucide-react';

export function ProjectRouteState({
    Header,
    setRoute,
    user,
    userToken,
    setUser,
    setUserToken,
    navigateTo,
    loading = false,
    eyebrow = 'Project',
    title = 'Project not found',
    message = 'This route no longer points to an available project.',
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
                        {loading ? (
                            <button className="secondary" type="button" onClick={() => window.location.reload()}>
                                <RefreshCcw size={16} /> Reload
                            </button>
                        ) : (
                            <>
                                <button className="secondary" type="button" onClick={() => navigateTo(setRoute, 'projects')}>
                                    <ArrowRight size={16} /> All projects
                                </button>
                                <button className="primary" type="button" onClick={() => navigateTo(setRoute, 'newProject')}>
                                    <FolderPlus size={16} /> New project
                                </button>
                            </>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
