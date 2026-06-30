import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Mail, MailOpen, Star, X } from 'lucide-react';
import { apiAcceptProjectInvite, apiListMessages, apiUpdateMessage } from '../api';
import { messageBelongsTo, readMessages, writeMessages } from '../messageStore';

export function MessagesPage({ Header, setRoute, user, userToken, setUser, setUserToken, openCompose }) {
    const [folder, setFolder] = useState('inbox');
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState(() => readMessages(user));
    const [actionMessage, setActionMessage] = useState('');
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
    }, [activeId]);

    async function loadMessages() {
        if (!userToken) {
            setMessages(readMessages(user));
            return;
        }
        try {
            setMessages(await apiListMessages(userToken));
        } catch {
            setMessages(readMessages(user));
        }
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
            setActionMessage('Invite accepted. Open Projects to see shared access.');
        } catch (error) {
            setActionMessage(error.message || 'Could not accept invite.');
        }
    }

    function declineInvite(message) {
        updateMessage(message.id, { read: true, meta: { ...message.meta, inviteStatus: 'DECLINED' } });
        setActionMessage('Invite declined.');
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
                            <button className={`${active?.id === message.id ? 'active' : ''} ${message.read ? '' : 'unread'}`} key={message.id} onClick={() => setActiveId(message.id)}>
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
                            <div>
                                <span className="eyebrow">{active.from} ({active.fromName})</span>
                                <h2>{active.subject}</h2>
                            </div>
                            <button type="button" onClick={() => setActiveId(null)}><X size={16} /> Close</button>
                        </div>
                        <div className="messageMetaGrid">
                            <span>To <strong>{active.to}</strong></span>
                            <span>{active.createdAt.slice(0, 16).replace('T', ' ')}</span>
                            <span>{active.meta?.inviteStatus || (active.read ? 'Read' : 'Unread')}</span>
                        </div>
                        {actionMessage && <div className="inlineNotice">{actionMessage}</div>}
                        <p>{active.body}</p>
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
                        <div className="messageModalActions">
                            <button className="secondary" type="button" onClick={() => toggleRead(active.id)}><MailOpen size={15} /> Mark {active.read ? 'unread' : 'read'}</button>
                            <button className="secondary" type="button" onClick={() => toggleStar(active.id)}><Star size={15} className={active.starred ? 'filled' : ''} /> {active.starred ? 'Unstar' : 'Star'}</button>
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

function serverPatch(patch) {
    const next = {};
    if (patch.read !== undefined) next.read = patch.read;
    if (patch.starred !== undefined) next.starred = patch.starred;
    if (patch.meta?.inviteStatus) next.invite_status = patch.meta.inviteStatus;
    return next;
}
