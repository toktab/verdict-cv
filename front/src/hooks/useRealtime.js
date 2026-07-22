import { useEffect, useRef } from 'react';
import { apiCreateRealtimeTicket, apiRealtimeUrl } from '../api/messageApi';

export function useRealtime(userToken, onProjectChanged, onAuditChanged) {
    const loadersRef = useRef(onProjectChanged);

    useEffect(() => {
        loadersRef.current = onProjectChanged;
    }, [onProjectChanged]);

    useEffect(() => {
        if (!userToken || typeof EventSource === 'undefined') return undefined;

        let source;
        let cancelled = false;

        apiCreateRealtimeTicket(userToken)
            .then(({ ticket }) => {
                if (cancelled) return;
                source = new EventSource(apiRealtimeUrl(ticket));

                source.addEventListener('project', () => {
                    if (loadersRef.current) {
                        loadersRef.current({ silent: true });
                    }
                    window.dispatchEvent(new Event('verdictProjectsChanged'));
                });

                source.addEventListener('message', () => {
                    window.dispatchEvent(new Event('verdictMessagesChanged'));
                });

                source.addEventListener('audit', (event) => {
                    window.dispatchEvent(
                        new CustomEvent('verdictAuditChanged', {
                            detail: JSON.parse(event.data || '{}'),
                        })
                    );
                    if (onAuditChanged) {
                        onAuditChanged(event);
                    }
                });

                source.onerror = () => {
                    window.dispatchEvent(new Event('verdictRealtimeDisconnected'));
                };
            })
            .catch(() => window.dispatchEvent(new Event('verdictRealtimeDisconnected')));

        return () => {
            cancelled = true;
            source?.close();
        };
    }, [userToken, onAuditChanged]);
}
