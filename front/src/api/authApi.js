import { get, post, patch, del } from '../http';
import { normaliseUser } from '../normalizers';

export async function apiRegister({ username, email, password, fullName, country, address, organization, role }) {
    return post('/auth/register', {
        username,
        email,
        password,
        fullName: fullName || username,
        country: country || 'Unspecified',
        address: address || 'Unspecified',
        organization: organization || 'Independent',
        role: role || 'Analyst',
    });
}

export async function apiLogin({ identifier, password }) {
    return post('/auth/login', { identifier, password });
}

export async function apiMe(token) {
    return get('/auth/me', token);
}

export async function apiLogout(token) {
    return post('/auth/logout', {}, token);
}

export async function apiUpdateNotificationPreferences({ enabled, mutedUntil = null }, token) {
    return normaliseUser(await patch('/auth/me/notifications', { enabled, mutedUntil }, token));
}

export async function apiListCmdSessions(token) {
    return get('/auth/me/cmd-sessions', token);
}

export async function apiCreateCmdPairingCode(token) {
    return post('/auth/me/cmd-pairing-code', {}, token);
}

export async function apiRevokeCmdSession(sessionId, token) {
    return del(`/auth/me/cmd-sessions/${encodeURIComponent(sessionId)}`, token);
}

export async function apiLookupUser(query, token) {
    return normaliseUser(await get(`/auth/users/lookup?q=${encodeURIComponent(query)}`, token));
}

export async function apiUpdateMe(payload, token) {
    return normaliseUser(await patch('/auth/me', payload, token));
}
