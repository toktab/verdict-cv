const URL_PATTERN = /https?:\/\/[^\s<>"')\]}]+/gi;
const BARE_PUBLIC_URL_PATTERN = /\b(?:www\.)?(?:github\.com|linkedin\.com|stackoverflow\.com|medium\.com|x\.com|twitter\.com)\/[^\s<>"')\]}]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
const RESERVED_GITHUB_PATHS = new Set([
    'features',
    'marketplace',
    'orgs',
    'settings',
    'topics',
]);

export function discoverCvPublicSources(cvText = '') {
    const uniqueUrls = new Set();
    const text = String(cvText);

    for (const pattern of [URL_PATTERN, BARE_PUBLIC_URL_PATTERN]) {
        for (const match of text.matchAll(pattern)) {
            uniqueUrls.add(normalizePublicUrl(match[0]));
        }
    }

    return [...uniqueUrls].slice(0, 25).map(describePublicSource);
}

function normalizePublicUrl(value) {
    const cleaned = value.replace(TRAILING_PUNCTUATION, '');
    return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
}

function describePublicSource(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        const firstPathPart = parsed.pathname.split('/').filter(Boolean)[0] || '';

        if (host === 'github.com' || host.endsWith('.github.com')) {
            const username = RESERVED_GITHUB_PATHS.has(firstPathPart.toLowerCase()) ? '' : firstPathPart;
            return {
                url,
                platform: 'GitHub',
                username,
                kind: 'github',
            };
        }
        if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
            return { url, platform: 'LinkedIn', username: '', kind: 'linkedin' };
        }
        if (host === 'stackoverflow.com' || host.endsWith('.stackoverflow.com')) {
            return { url, platform: 'Stack Overflow', username: '', kind: 'stackoverflow' };
        }

        return {
            url,
            platform: host || 'Public link',
            username: '',
            kind: 'public-link',
        };
    } catch {
        return {
            url,
            platform: 'Public link',
            username: '',
            kind: 'public-link',
        };
    }
}
