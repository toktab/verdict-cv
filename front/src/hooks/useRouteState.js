import { useEffect, useState } from 'react';

export function useRouteState(parseRoute) {
  const initialRoute = parseRoute();
  const [route, setRoute] = useState(initialRoute.route);
  const [detailAuditId, setDetailAuditId] = useState(initialRoute.auditId);

  useEffect(() => {
    function syncRouteFromLocation() {
      const next = parseRoute(window.location.pathname);
      setRoute(next.route);
      setDetailAuditId(next.auditId);
    }

    window.addEventListener('popstate', syncRouteFromLocation);
    return () => window.removeEventListener('popstate', syncRouteFromLocation);
  }, [parseRoute]);

  return { route, setRoute, detailAuditId, setDetailAuditId };
}
