export function auditScoreLevel(score = 0) {
    return Math.max(1, Math.min(10, Math.ceil(Number(score || 0) / 10)));
}
