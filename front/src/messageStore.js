export const MESSAGE_STORE_KEY = 'verdictMessages';

export function readMessages(user) {
    try {
        const rows = JSON.parse(localStorage.getItem(MESSAGE_STORE_KEY) || '[]');
        if (Array.isArray(rows) && rows.length) {
            return rows.map((message) => ({ read: false, ...message }));
        }
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
        read: false,
    }];
}

export function writeMessages(messages) {
    localStorage.setItem(MESSAGE_STORE_KEY, JSON.stringify(messages));
    window.dispatchEvent(new Event('verdictMessagesChanged'));
}

export function createMessage({ from, fromName, to, subject, body, type = 'message', meta = {}, replyToMessageId = null, forwardedFromMessageId = null, candidateAttachments = [] }) {
    return {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        from,
        fromName,
        to,
        subject: subject?.trim() || 'No subject',
        body: body?.trim() || '',
        createdAt: new Date().toISOString(),
        starred: false,
        read: false,
        type,
        meta,
        replyToMessageId,
        forwardedFromMessageId,
        candidateAttachments,
        archived: false,
        deliveryStatus: 'SAVED_OFFLINE',
    };
}

export function appendMessage(message, user) {
    writeMessages([message, ...readMessages(user)]);
}

export function messageBelongsTo(message, user, field = 'to') {
    const value = normalizeRecipient(message?.[field]);
    const targets = [
        user?.email,
        user?.username,
        user?.fullName,
    ].map(normalizeRecipient).filter(Boolean);
    return targets.includes(value);
}

function normalizeRecipient(value = '') {
    return String(value).trim().toLowerCase();
}
