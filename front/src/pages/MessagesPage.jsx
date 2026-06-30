import { useEffect, useMemo, useState } from 'react';
import { Mail, MailOpen, Star, X } from 'lucide-react';
import { readMessages, writeMessages } from '../messageStore';

export function MessagesPage({ Header, setRoute, user, userToken, setUser, setUserToken, openCompose }) {
    const [folder, setFolder] = useState('inbox');
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState(() => readMessages(user));
    const visible = useMemo(() => messages.filter((message) => {
        if (folder === 'sent') return message.from === user?.email;
        if (folder === 'starred') return message.starred;
        return message.to === user?.email;
    }), [folder, messages, user?.email]);
    const active = visible.find((message) => message.id === activeId) || null;

    useEffect(() => {
        function refreshMessages() {
            setMessages(readMessages(user));
        }
        window.addEventListener('verdictMessagesChanged', refreshMessages);
        return () => window.removeEventListener('verdictMessagesChanged', refreshMessages);
    }, [user]);

    function updateMessage(id, patch) {
        const updated = messages.map((message) => message.id === id ? { ...message, ...patch } : message);
        setMessages(updated);
        writeMessages(updated);
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
                            <span>{active.read ? 'Read' : 'Unread'}</span>
                        </div>
                        <p>{active.body}</p>
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
