import { useState } from 'react';

export function useRouteState(parseRoute) {
  const initialRoute = parseRoute();
  const [route, setRoute] = useState(initialRoute.route);
  const [detailAuditId, setDetailAuditId] = useState(initialRoute.auditId);
  return { route, setRoute, detailAuditId, setDetailAuditId };
}
