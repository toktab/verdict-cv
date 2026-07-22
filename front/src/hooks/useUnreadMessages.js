import { useEffect, useRef, useState } from 'react';
import { apiListMessages } from '../api/messageApi';
import { messageBelongsTo, readMessages } from '../messageStore';

export function useUnreadMessages(user, userToken) {
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [messageNotice, setMessageNotice] = useState(null);
    const seenInboundMessageIds = useRef(new Set());

    useEffect(() => {
        let cancelled = false;

        async function refreshUnreadMessages() {
            if (!user) {
                setUnreadMessages(0);
                setMessageNotice(null);
                return;
            }
            try {
                const rows = userToken ? await apiListMessages(userToken) : readMessages(user);
                if (!cancelled) {
                    const inbound = rows.filter((msg) => messageBelongsTo(msg, user, 'to'));
                    const unread = inbound.filter((msg) => !msg.read);
                    setUnreadMessages(unread.length);

                    const nextIds = new Set(inbound.map((msg) => String(msg.id)));
                    const fresh = inbound.find(
                        (msg) => !seenInboundMessageIds.current.has(String(msg.id))
                    );
                    if (seenInboundMessageIds.current.size > 0 && fresh && shouldShowMessageNotice(user)) {
                        setMessageNotice(fresh);
                    }
                    seenInboundMessageIds.current = nextIds;
                }
            } catch {
                if (!cancelled && !userToken) {
                    setUnreadMessages(
                        readMessages(user).filter(
                            (msg) => !msg.read && messageBelongsTo(msg, user, 'to')
                        ).length
                    );
                }
            }
        }

        refreshUnreadMessages();
        window.addEventListener('verdictMessagesChanged', refreshUnreadMessages);
        window.addEventListener('focus', refreshUnreadMessages);

        return () => {
            cancelled = true;
            window.removeEventListener('verdictMessagesChanged', refreshUnreadMessages);
            window.removeEventListener('focus', refreshUnreadMessages);
        };
    }, [user, userToken]);

    function clearNotice() {
        setMessageNotice(null);
    }

    return { unreadMessages, messageNotice, setMessageNotice, clearNotice };
}

function readNotificationSettings(user) {
    return {
        messageNoticesEnabled: user?.messageNotificationsEnabled !== false,
        mutedUntil: user?.messageNotificationsMutedUntil || null,
    };
}

function shouldShowMessageNotice(user) {
    const settings = readNotificationSettings(user);
    if (settings.messageNoticesEnabled === false) return false;
    if (settings.mutedUntil && new Date(settings.mutedUntil).getTime() > Date.now()) return false;
    return true;
}
