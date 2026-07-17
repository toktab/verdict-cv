import { useEffect, useState } from 'react';
import { Send, X } from 'lucide-react';
import { apiLookupUser, apiSendMessage } from '../api';
import { appendMessage, createMessage } from '../messageStore';
import { readUserToken } from '../sessionAuth';

export function GlobalCompose({ draft, open, setDraft, setOpen, user }) {
    const [composeState, setComposeState] = useState('idle');
    const [composeError, setComposeError] = useState('');
    const [recipientLookup, setRecipientLookup] = useState({ state: 'idle', user: null, query: '' });

    useEffect(() => {
        if (open) {
            setComposeState('idle');
            setComposeError('');
            setRecipientLookup({ state: 'idle', user: null, query: '' });
        }
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const query = (draft.to || '').trim();
        const token = readUserToken();
        if (!query || !token) {
            setRecipientLookup({ state: 'idle', user: null, query });
            return undefined;
        }
        const timeout = window.setTimeout(() => {
            setRecipientLookup({ state: 'loading', user: null, query });
            apiLookupUser(query, token)
                .then((found) => setRecipientLookup({ state: 'found', user: found, query }))
                .catch(() => setRecipientLookup({ state: query.includes('@') ? 'external' : 'missing', user: null, query }));
        }, 240);
        return () => window.clearTimeout(timeout);
    }, [draft.to, open]);

    if (!open) return null;

    const canEdit = composeState === 'idle' || composeState === 'failed';

    async function sendMessage(event) {
        event.preventDefault();
        if (composeState === 'sending') return;
        setComposeState('sending');
        setComposeError('');
        const token = readUserToken();
        try {
            if (token) {
                await apiSendMessage({
                    to: recipientLookup.user?.email || draft.to.trim(),
                    subject: draft.subject,
                    body: draft.body,
                    replyToMessageId: draft.replyToMessageId,
                    forwardedFromMessageId: draft.forwardedFromMessageId,
                    candidateAttachments: draft.candidateAttachments || [],
                }, token);
                window.dispatchEvent(new Event('verdictMessagesChanged'));
            } else {
                saveOfflineMessage();
            }
        } catch {
            setComposeState('failed');
            setComposeError('Server delivery failed. Check the recipient or connection, then retry.');
            return;
        }
        setComposeState('sent');
        await new Promise((resolve) => setTimeout(resolve, 520));
        setDraft(emptyComposeDraft());
        setComposeState('idle');
        setOpen(false);
    }

    function saveOfflineMessage() {
        appendMessage(createMessage({
            from: user?.email || 'me@verdict.local',
            fromName: user?.fullName || user?.username || 'Current user',
            to: draft.to.trim(),
            subject: draft.subject,
            body: draft.body,
            replyToMessageId: draft.replyToMessageId,
            forwardedFromMessageId: draft.forwardedFromMessageId,
            candidateAttachments: draft.candidateAttachments || [],
        }), user);
        window.dispatchEvent(new Event('verdictMessagesChanged'));
    }

    function saveOfflineAndClose() {
        saveOfflineMessage();
        setDraft(emptyComposeDraft());
        setComposeError('');
        setComposeState('idle');
        setOpen(false);
    }

    return (
        <form className={`gmailCompose ${composeState}`} onSubmit={sendMessage} role="dialog" aria-modal="true" aria-labelledby="compose-title">
            <div className="composeHead">
                <strong id="compose-title">{composeState === 'sent' ? 'Message sent' : composeState === 'sending' ? 'Sending...' : composeState === 'failed' ? 'Delivery failed' : 'New Message'}</strong>
                <button type="button" aria-label="Close compose" data-dialog-close disabled={composeState === 'sending'} onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            <div className="composeSendTrack"><span /></div>
            {composeError && <div className="composeError">{composeError}</div>}
            <label className="composeRecipientField">
                <span>To</span>
                <input autoFocus data-dialog-initial-focus value={draft.to} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, to: event.target.value })} placeholder="Username or email" required />
            </label>
            <RecipientPreview lookup={recipientLookup} rawValue={draft.to} />
            <input value={draft.subject} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} placeholder="Subject" />
            <textarea value={draft.body} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Description" required />
            {Boolean(draft.candidateAttachments?.length) && (
                <div className="composeCandidateAttachments">
                    {draft.candidateAttachments.map((candidate) => (
                        <span key={`${candidate.projectId}-${candidate.candidateId}`}><strong>{candidate.name}</strong><small>{candidate.role} / {candidate.score}%</small></span>
                    ))}
                </div>
            )}
            <div className="composeActions">
                <button className="primary composeSendButton" disabled={!canEdit} type="submit"><Send size={16} /> {composeState === 'failed' ? 'Retry' : composeState === 'sending' ? 'Sending' : composeState === 'sent' ? 'Sent' : 'Send'}</button>
                {composeState === 'failed' && !readUserToken() && <button className="secondary" type="button" onClick={saveOfflineAndClose}>Save offline</button>}
            </div>
        </form>
    );
}

function RecipientPreview({ lookup, rawValue }) {
    const value = (rawValue || '').trim();
    if (!value) return null;
    if (lookup.state === 'loading') {
        return <div className="recipientPreview loading"><span className="recipientAvatar">...</span><div><strong>Looking up recipient</strong><small>{value}</small></div></div>;
    }
    if (lookup.user) {
        return (
            <div className="recipientPreview found">
                <span className="recipientAvatar">{userInitials(lookup.user)}</span>
                <div>
                    <strong>{lookup.user.fullName || lookup.user.username}</strong>
                    <small>{lookup.user.username} / {lookup.user.email}</small>
                </div>
            </div>
        );
    }
    if (lookup.state === 'external') {
        return <div className="recipientPreview external"><span className="recipientAvatar">@</span><div><strong>External email</strong><small>{value}</small></div></div>;
    }
    if (lookup.state === 'missing') {
        return <div className="recipientPreview missing"><span className="recipientAvatar">?</span><div><strong>No VERDICT user found</strong><small>Check the username or enter a full email address.</small></div></div>;
    }
    return null;
}

function userInitials(user) {
    const source = user?.fullName || user?.username || user?.email || 'U';
    return source.split(/\s+/).map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase();
}

function emptyComposeDraft() {
    return { to: '', subject: '', body: '', replyToMessageId: null, forwardedFromMessageId: null, candidateAttachments: [] };
}
