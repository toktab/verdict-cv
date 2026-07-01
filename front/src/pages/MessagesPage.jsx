import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CornerUpLeft, Forward, Mail, MailOpen, Star, X } from 'lucide-react';
import { apiAcceptProjectInvite, apiListMessages, apiUpdateMessage } from '../api';
import { messageBelongsTo, readMessages, writeMessages } from '../messageStore';

export function MessagesPage({ Header, setRoute, user, userToken, setUser, setUserToken, openCompose, onProjectsChange }) {
    const [folder, setFolder] = useState('inbox');
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState(() => readMessages(user));
    const [actionMessage, setActionMessage] = useState('');
    const [highlightedId, setHighlightedId] = useState(null);
    const seenMessageIds = useRef(new Set());
    const visible = useMemo(() => messages.filter((message) => {
        if (folder === 'sent') return messageBelongsTo(message, user, 'from');
        if (folder === 'starred') return message.starred;
        return messageBelongsTo(message, user, 'to');
    }), [folder, messages, user?.email, user?.username, user?.fullName]);
    const active = visible.find((message) => message.id === activeId) || null;

    useEffect(() => {
        function refreshMessages() {
            loadMessages();
        }
        loadMessages();
        window.addEventListener('verdictMessagesChanged', refreshMessages);
        return () => window.removeEventListener('verdictMessagesChanged', refreshMessages);
    }, [user, userToken]);

    useEffect(() => {
        setActionMessage('');
        const message = visible.find((row) => row.id === activeId);
        if (message && !message.read && messageBelongsTo(message, user, 'to')) {
            updateMessage(message.id, { read: true });
        }
    }, [activeId]);

    async function loadMessages() {
        let rows;
        if (!userToken) {
            rows = readMessages(user);
        } else {
            try {
                rows = await apiListMessages(userToken);
            } catch {
                rows = readMessages(user);
            }
        }
        const nextIds = new Set(rows.map((message) => String(message.id)));
        const fresh = rows.find((message) => !seenMessageIds.current.has(String(message.id)));
        if (seenMessageIds.current.size > 0 && fresh) {
            setHighlightedId(String(fresh.id));
            window.setTimeout(() => setHighlightedId(null), 1600);
        }
        seenMessageIds.current = nextIds;
        setMessages(rows);
    }

    function updateMessage(id, patch) {
        const updated = messages.map((message) => message.id === id ? { ...message, ...patch } : message);
        setMessages(updated);
        const message = messages.find((row) => row.id === id);
        if (message?.serverBacked) {
            apiUpdateMessage(id, serverPatch(patch), userToken).then(loadMessages).catch(() => writeMessages(updated));
        } else {
            writeMessages(updated);
        }
    }

    function toggleStar(id) {
        const message = messages.find((row) => row.id === id);
        if (message) {
            updateMessage(id, { starred: !message.starred });
        }
    }

    function toggleRead(id) {
        const message = messages.find((row) => row.id === id);
        if (message) {
            updateMessage(id, { read: !message.read });
        }
    }

    async function acceptInvite(message) {
        setActionMessage('');
        try {
            await apiAcceptProjectInvite(message.meta.inviteToken, userToken);
            updateMessage(message.id, { read: true, meta: { ...message.meta, inviteStatus: 'ACCEPTED' } });
            await onProjectsChange?.();
            setActionMessage('Invite accepted. Open Projects to see shared access.');
        } catch (error) {
            setActionMessage(error.message || 'Could not accept invite.');
        }
    }

    function declineInvite(message) {
        updateMessage(message.id, { read: true, meta: { ...message.meta, inviteStatus: 'DECLINED' } });
        setActionMessage('Invite declined.');
    }

    function replyTo(message) {
        openCompose?.({
            to: message.from,
            subject: prefixedSubject('Re:', message.subject),
            body: `\n\nOn ${formatMessageDate(message.createdAt)}, ${message.fromName || message.from} wrote:\n${quoteBody(message.body)}`,
            replyToMessageId: message.serverBacked ? Number(message.id) : null,
        });
    }

    function forwardMessage(message) {
        openCompose?.({
            subject: prefixedSubject('Fwd:', message.subject),
            body: `\n\n---------- Forwarded message ----------\nFrom: ${message.from} (${message.fromName || 'Unknown'})\nTo: ${message.to}\nDate: ${formatMessageDate(message.createdAt)}\nSubject: ${message.subject}\n\n${message.body}`,
            forwardedFromMessageId: message.serverBacked ? Number(message.id) : null,
        });
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="messagesPage contentFadeIn">
                <aside className="messagesSidebar">
                    <button className="primary" onClick={() => openCompose?.()}><Mail size={18} /> Compose</button>
                    <button className={folder === 'inbox' ? 'active' : ''} onClick={() => setFolder('inbox')}>Inbox</button>
                    <button className={folder === 'sent' ? 'active' : ''} onClick={() => setFolder('sent')}>Sent</button>
                    <button className={folder === 'starred' ? 'active' : ''} onClick={() => setFolder('starred')}>Starred</button>
                </aside>
                <section className="messageListPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Messages</span>
                            <h1>{folderLabel(folder)}</h1>
                        </div>
                        <span>{visible.length} message{visible.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="messageRows">
                        {visible.map((message) => (
                            <button className={`${active?.id === message.id ? 'active' : ''} ${message.read ? '' : 'unread'} ${highlightedId === String(message.id) ? 'fresh' : ''}`} key={message.id} onClick={() => setActiveId(message.id)}>
                                <Star size={16} className={message.starred ? 'filled' : ''} onClick={(event) => { event.stopPropagation(); toggleStar(message.id); }} />
                                <strong>{message.from} ({message.fromName})</strong>
                                <span>{message.subject}</span>
                                <small>{message.body}</small>
                                <span className="messageStatus">{message.read ? 'Read' : 'Unread'}</span>
                                <span
                                    className="messageMarkButton"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        toggleRead(message.id);
                                    }}
                                >
                                    <MailOpen size={14} /> Mark {message.read ? 'unread' : 'read'}
                                </span>
                            </button>
                        ))}
                        {!visible.length && <p className="mutedPanelText">No messages in this folder yet.</p>}
                    </div>
                </section>
            </main>
            {active && (
                <div className="messageModalBackdrop" role="dialog" aria-modal="true">
                    <article className="messageModal">
                        <div className="messageModalHead">
                            <button className="messageCloseButton" aria-label="Close message" type="button" onClick={() => setActiveId(null)}><X size={28} /></button>
                            <div>
                                <span className="eyebrow">{active.type === 'projectInvite' ? 'Project invite' : folder === 'sent' ? 'Sent message' : 'Inbox message'}</span>
                                <h2>{active.subject}</h2>
                            </div>
                        </div>
                        <div className="messageModalToolbar">
                            <button className="primary" type="button" onClick={() => replyTo(active)}><CornerUpLeft size={16} /> Reply</button>
                            <button className="secondary" type="button" onClick={() => forwardMessage(active)}><Forward size={16} /> Forward</button>
                            <button className="secondary" type="button" onClick={() => toggleRead(active.id)}><MailOpen size={15} /> Mark {active.read ? 'unread' : 'read'}</button>
                            <button className="secondary" type="button" onClick={() => toggleStar(active.id)}><Star size={15} className={active.starred ? 'filled' : ''} /> {active.starred ? 'Unstar' : 'Star'}</button>
                        </div>
                        <div className="messageModalScroll">
                        <div className="messagePeopleCard">
                            <div>
                                <span>From</span>
                                <strong>{active.fromName || 'Unknown sender'}</strong>
                                <small>{active.from}</small>
                            </div>
                            <div>
                                <span>To</span>
                                <strong>{recipientName(active.to, user)}</strong>
                                <small>{active.to}</small>
                            </div>
                        </div>
                        {actionMessage && <div className="inlineNotice">{actionMessage}</div>}
                        <div className="messageMetaGrid">
                            <span>When <strong>{formatMessageDate(active.createdAt)}</strong></span>
                            <span>Status <strong>{active.meta?.inviteStatus || (active.read ? 'Read' : 'Unread')}</strong></span>
                            <span>Type <strong>{active.type === 'projectInvite' ? 'Invite alert' : 'Mail message'}</strong></span>
                            {active.meta?.projectTitle && <span>Project <strong>{active.meta.projectTitle}</strong></span>}
                        </div>
                        {active.type === 'projectInvite' && active.meta?.inviteStatus === 'PENDING' && (
                            <div className="inviteDecisionBox">
                                <strong>Project invitation</strong>
                                <span>{active.meta.projectTitle}</span>
                                <div>
                                    <button className="primary" type="button" onClick={() => acceptInvite(active)}><CheckCircle2 size={15} /> Accept</button>
                                    <button className="destructive" type="button" onClick={() => declineInvite(active)}><X size={15} /> Decline</button>
                                </div>
                            </div>
                        )}
                        <section className="messageBodyCard">
                            <span className="eyebrow">Message</span>
                            <p>{active.body}</p>
                        </section>
                        <section className="messageInfoCard">
                            <strong>Delivery details</strong>
                            <span>Message ID: {active.id}</span>
                            <span>Sender mail: {active.from}</span>
                            <span>Sender name: {active.fromName || 'Unknown'}</span>
                            <span>Recipient mail: {active.to}</span>
                            <span>Title: {active.subject}</span>
                        </section>
                        </div>
                        <div className="messageModalActions">
                            <button className="primary" type="button" onClick={() => replyTo(active)}><CornerUpLeft size={15} /> Reply</button>
                            <button className="secondary" type="button" onClick={() => forwardMessage(active)}><Forward size={15} /> Forward</button>
                            <button className="secondary" type="button" onClick={() => setActiveId(null)}><X size={15} /> Close</button>
                        </div>
                    </article>
                </div>
            )}
        </div>
    );
}

function folderLabel(folder) {
    if (folder === 'sent') return 'Sent';
    if (folder === 'starred') return 'Starred';
    return 'Inbox';
}

function prefixedSubject(prefix, subject = '') {
    return subject.toLowerCase().startsWith(prefix.toLowerCase()) ? subject : `${prefix} ${subject || 'No subject'}`;
}

function quoteBody(body = '') {
    return body.split(/\r?\n/).map((line) => `> ${line}`).join('\n');
}

function formatMessageDate(value = '') {
    if (!value) return 'Unknown time';
    return String(value).slice(0, 16).replace('T', ' ');
}

function recipientName(email, user) {
    if (messageBelongsTo({ to: email }, user, 'to')) {
        return user?.fullName || user?.username || 'You';
    }
    return email?.split('@')[0] || 'Recipient';
}

function serverPatch(patch) {
    const next = {};
    if (patch.read !== undefined) next.read = patch.read;
    if (patch.starred !== undefined) next.starred = patch.starred;
    if (patch.meta?.inviteStatus) next.invite_status = patch.meta.inviteStatus;
    return next;
}
