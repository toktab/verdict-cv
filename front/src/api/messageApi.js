import { get, post, patch } from '../http';
import { normaliseMessage } from '../normalizers';

const BASE = '/api';

export async function apiListMessages(token) {
    const rows = await get('/messages', token);
    return rows.map(normaliseMessage);
}

export async function apiListMessagesPage({ page = 0, size = 25, search = '' } = {}, token) {
    const params = new URLSearchParams({ page: String(page), size: String(size), search });
    const result = await get(`/messages/page?${params}`, token);
    return { ...result, items: (result.items || []).map(normaliseMessage) };
}

export async function apiCreateRealtimeTicket(token) {
    return post('/realtime/ticket', {}, token);
}

export function apiRealtimeUrl(ticket) {
    return `${BASE}/realtime?ticket=${encodeURIComponent(ticket || '')}`;
}

export async function apiSendMessage({ to, subject, body, replyToMessageId, forwardedFromMessageId, candidateAttachments = [] }, token) {
    return normaliseMessage(await post('/messages', {
        to,
        subject,
        body,
        reply_to_message_id: replyToMessageId || null,
        forwarded_from_message_id: forwardedFromMessageId || null,
        candidate_attachments: candidateAttachments,
    }, token));
}

export async function apiUpdateMessage(id, payload, token) {
    return normaliseMessage(await patch(`/messages/${id}`, payload, token));
}
