import defaultAts from '../data/default-ats.json';

export function findCatchphraseMatches(text) {
    if (!text) return [];
    const matches = [];
    defaultAts.rules.forEach((rule) => {
        keywordPatterns(rule).forEach((pattern) => collectMatches(text, pattern, rule, matches));
        (rule.patterns || []).forEach((pattern) => collectMatches(text, pattern, rule, matches));
    });
    return dedupeMatches(matches).sort((a, b) => a.start - b.start);
}

export function riskToSeverity(risk) {
    if (risk === 'High') return 'high';
    if (risk === 'Medium') return 'medium';
    return 'low';
}

function keywordPatterns(rule) {
    return (rule.keywords || []).map((keyword) => `\\b${escapeRegExp(keyword)}\\b`);
}

function collectMatches(text, pattern, rule, matches) {
    try {
        const regex = new RegExp(pattern, 'gi');
        for (const match of text.matchAll(regex)) {
            matches.push({
                id: `${rule.id}-${match.index}-${match[0]}`,
                text: match[0],
                start: match.index,
                end: match.index + match[0].length,
                label: rule.label,
                category: rule.category,
                risk: rule.risk,
                severity: riskToSeverity(rule.risk),
                why: rule.why,
                safer: rule.safer,
            });
        }
    } catch {
        // Ignore malformed admin-authored patterns instead of breaking analysis.
    }
}

function dedupeMatches(matches) {
    const seen = new Set();
    return matches.filter((match) => {
        const key = `${match.start}-${match.end}-${match.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
