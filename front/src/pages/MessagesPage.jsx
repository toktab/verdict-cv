import { useMemo, useState } from 'react';
import { Mail, Send, Star, X } from 'lucide-react';

const STORE_KEY = 'verdictMessages';

export function MessagesPage({ Header, setRoute, user, userToken, setUser, setUserToken }) {
    const [folder, setFolder] = useState('inbox');
    const [composeOpen, setComposeOpen] = useState(false);
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState(() => readMessages(user));
    const [draft, setDraft] = useState({ to: '', subject: '', body: '' });
    const visible = useMemo(() => messages.filter((message) => {
        if (folder === 'sent') return message.from === user?.email;
        if (folder === 'starred') return message.starred;
        return message.to === user?.email;
    }), [folder, messages, user?.email]);
    const active = visible.find((message) => message.id === activeId) || visible[0];

    function sendMessage(event) {
        event.preventDefault();
        const next = {
            id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            from: user?.email || 'me@verdict.local',
            fromName: user?.fullName || user?.username || 'Current user',
            to: draft.to.trim(),
            subject: draft.subject.trim() || 'No subject',
            body: draft.body.trim(),
            createdAt: new Date().toISOString(),
            starred: false,
        };
        const updated = [next, ...messages];
        setMessages(updated);
        writeMessages(updated);
        setDraft({ to: '', subject: '', body: '' });
        setFolder('sent');
        setActiveId(next.id);
        setComposeOpen(false);
    }

    function toggleStar(id) {
        const updated = messages.map((message) => message.id === id ? { ...message, starred: !message.starred } : message);
        setMessages(updated);
        writeMessages(updated);
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="messagesPage contentFadeIn">
                <aside className="messagesSidebar">
                    <button className="primary" onClick={() => setComposeOpen(true)}><Mail size={18} /> Compose</button>
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
                            <button className={active?.id === message.id ? 'active' : ''} key={message.id} onClick={() => setActiveId(message.id)}>
                                <Star size={16} className={message.starred ? 'filled' : ''} onClick={(event) => { event.stopPropagation(); toggleStar(message.id); }} />
                                <strong>{message.from} ({message.fromName})</strong>
                                <span>{message.subject}</span>
                                <small>{message.body}</small>
                            </button>
                        ))}
                        {!visible.length && <p className="mutedPanelText">No messages in this folder yet.</p>}
                    </div>
                </section>
                <section className="messageReadPane">
                    {active ? (
                        <>
                            <span className="eyebrow">{active.from} ({active.fromName})</span>
                            <h2>{active.subject}</h2>
                            <small>To {active.to} / {active.createdAt.slice(0, 16).replace('T', ' ')}</small>
                            <p>{active.body}</p>
                        </>
                    ) : (
                        <p className="mutedPanelText">Select a message to read it.</p>
                    )}
                </section>
            </main>
            {composeOpen && (
                <form className="gmailCompose" onSubmit={sendMessage}>
                    <div className="composeHead">
                        <strong>New Message</strong>
                        <button type="button" onClick={() => setComposeOpen(false)}><X size={16} /></button>
                    </div>
                    <input value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} placeholder="Recipients" required />
                    <input value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} placeholder="Subject" />
                    <textarea value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Description" required />
                    <button className="primary" type="submit"><Send size={16} /> Send</button>
                </form>
            )}
        </div>
    );
}

function folderLabel(folder) {
    if (folder === 'sent') return 'Sent';
    if (folder === 'starred') return 'Starred';
    return 'Inbox';
}

function readMessages(user) {
    try {
        const rows = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
        if (rows.length) return rows;
    } catch {
        // Use fallback seed.
    }
    return [{
        id: 'welcome',
        from: 'system@verdict.local',
        fromName: 'VERDICT',
        to: user?.email || '',
        subject: 'Welcome to Messages',
        body: 'Use Compose to send candidate review notes or project updates to collaborators.',
        createdAt: new Date().toISOString(),
        starred: false,
    }];
}

function writeMessages(messages) {
    localStorage.setItem(STORE_KEY, JSON.stringify(messages));
}
