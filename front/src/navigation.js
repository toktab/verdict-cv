export function routeFromPath(pathname = window.location.pathname) {
    if (pathname === '/admin') return { route: 'admin' };
    if (pathname === '/dashboard') return { route: 'dashboard' };
    if (pathname === '/history') return { route: 'history' };
    if (pathname === '/messages') return { route: 'messages' };
    if (pathname === '/profile') return { route: 'profile' };
    if (pathname === '/projects') return { route: 'projects' };
    if (pathname === '/projects/new') return { route: 'newProject' };
    if (pathname.match(/^\/projects\/([^/]+)\/candidates\/new$/)) return { route: 'addCandidate' };
    if (pathname.match(/^\/projects\/([^/]+)\/team$/)) return { route: 'projectTeam' };
    if (pathname.match(/^\/projects\/([^/]+)\/settings$/)) return { route: 'projectSettings' };
    if (pathname.match(/^\/projects\/([^/]+)\/candidates\/([^/]+)\/signaltrace$/)) return { route: 'signalTrace' };
    if (pathname.match(/^\/projects\/([^/]+)\/candidates\/([^/]+)\/profile$/)) return { route: 'candidateProfile' };
    if (pathname.match(/^\/projects\/([^/]+)\/candidates\/([^/]+)$/)) return { route: 'candidateDetail' };
    if (pathname.match(/^\/projects\/([^/]+)$/)) return { route: 'projectDetail' };
    const profileMatch = pathname.match(/^\/audit\/(\d+)\/profile$/);
    if (profileMatch) return { route: 'auditProfile', auditId: Number(profileMatch[1]) };
    const auditMatch = pathname.match(/^\/audit\/(\d+)$/);
    if (auditMatch) return { route: 'auditDetail', auditId: Number(auditMatch[1]) };
    if (pathname === '/audit') return { route: 'app' };
    if (pathname === '/login') return { route: 'login' };
    if (pathname === '/register') return { route: 'register' };
    return { route: 'home' };
}

export function pathForRoute(next, id, childId) {
    if (next === 'admin') return '/admin';
    if (next === 'dashboard') return '/dashboard';
    if (next === 'history') return '/history';
    if (next === 'messages') return '/messages';
    if (next === 'projects') return '/projects';
    if (next === 'newProject') return '/projects/new';
    if (next === 'projectDetail') return `/projects/${id}`;
    if (next === 'projectTeam') return `/projects/${id}/team`;
    if (next === 'projectSettings') return `/projects/${id}/settings`;
    if (next === 'addCandidate') return `/projects/${id}/candidates/new`;
    if (next === 'signalTrace') return `/projects/${id}/candidates/${childId}/signaltrace`;
    if (next === 'candidateProfile') return `/projects/${id}/candidates/${childId}/profile`;
    if (next === 'candidateDetail') return `/projects/${id}/candidates/${childId}`;
    if (next === 'profile') return '/profile';
    if (next === 'auditProfile') return `/audit/${id}/profile`;
    if (next === 'auditDetail') return `/audit/${id}`;
    if (next === 'app') return '/projects';
    if (next === 'login') return '/login';
    if (next === 'register') return '/register';
    return '/';
}

export function navigateTo(setRoute, next, id, childId) {
    setRoute(next);
    window.history.replaceState(null, '', pathForRoute(next, id, childId));
    scrollToPageTop();
}

export function scrollToPageTop() {
    window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    });
}
