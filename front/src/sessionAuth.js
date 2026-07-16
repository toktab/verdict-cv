const USER_TOKEN_KEY = 'verdictUserToken';
const ADMIN_TOKEN_KEY = 'verdictAdminToken';

export const readUserToken = () => readSessionToken(USER_TOKEN_KEY);
export const writeUserToken = (token) => writeSessionToken(USER_TOKEN_KEY, token);
export const clearUserToken = () => clearSessionToken(USER_TOKEN_KEY);
export const readAdminToken = () => readSessionToken(ADMIN_TOKEN_KEY);
export const writeAdminToken = (token) => writeSessionToken(ADMIN_TOKEN_KEY, token);
export const clearAdminToken = () => clearSessionToken(ADMIN_TOKEN_KEY);

function readSessionToken(key) {
    if (typeof window === 'undefined') return '';
    const token = window.sessionStorage.getItem(key) || '';
    window.localStorage.removeItem(key);
    return token;
}

function writeSessionToken(key, token) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    if (token) window.sessionStorage.setItem(key, token);
    else window.sessionStorage.removeItem(key);
}

function clearSessionToken(key) {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
}
