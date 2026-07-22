export function normaliseProject(raw) {
    return {
        id: raw.id,
        title: raw.title,
        department: raw.department || '',
        location: raw.location || '',
        description: raw.description || '',
        requirements: raw.requirements || [],
        rubric: raw.rubric || {},
        state: raw.state || 'WAR State',
        status: raw.status || 'Screening',
        ownerId: raw.owner_id || raw.ownerId || null,
        myRole: raw.my_role || raw.myRole || '',
        myPermissions: raw.my_permissions || raw.myPermissions || [],
        settings: raw.settings || {},
        openedAt: raw.opened_at ? raw.opened_at.slice(0, 10) : (raw.created_at ? raw.created_at.slice(0, 10) : ''),
        candidates: (raw.candidates || []).map(normaliseCandidate),
    };
}

export function normaliseCandidate(raw) {
    return {
        id: raw.id,
        name: raw.name,
        email: raw.email || '',
        role: raw.role || '',
        score: raw.score || 0,
        match: raw.match || 0,
        fitScore: raw.fit_score ?? raw.fitScore ?? raw.match ?? 0,
        evidenceScore: raw.evidence_score ?? raw.evidenceScore ?? 0,
        githubMatchScore: raw.github_match_score ?? raw.githubMatchScore ?? 0,
        reviewerScore: raw.reviewer_score ?? raw.reviewerScore ?? 0,
        risk: raw.risk || 'Low',
        state: raw.state || 'Pending',
        osint: raw.osint || 'Not started',
        memory: raw.memory || 'No prior record',
        analysisState: raw.analysis_state || raw.analysisState || '',
        analysisEngine: raw.analysis_engine || raw.analysisEngine || '',
        analysisPromptVersion: raw.analysis_prompt_version || raw.analysisPromptVersion || '',
        analysisCompletedAt: raw.analysis_completed_at || raw.analysisCompletedAt || '',
        promptTokens: raw.prompt_tokens || raw.promptTokens || 0,
        completionTokens: raw.completion_tokens || raw.completionTokens || 0,
        totalTokens: raw.total_tokens || raw.totalTokens || 0,
        estimatedCostUsd: raw.estimated_cost_usd || raw.estimatedCostUsd || 0,
        initializedAnalysisStates: raw.initialized_analysis_states || raw.initializedAnalysisStates || [],
        memoryHistory: raw.memory_history || raw.memoryHistory || [],
        cvText: raw.cv_text || raw.cvText || '',
        resumeFilename: raw.resume_filename || '',
        coreCandidateId: raw.core_candidate_id || '',
        cvId: raw.cv_id || '',
        verificationCaseId: raw.verification_case_id || '',
        submittedAt: raw.submitted_at ? raw.submitted_at.slice(0, 10) : '',
        flags: raw.flags || 0,
        supported: raw.supported || 0,
        stretched: raw.stretched || 0,
        unsupported: raw.unsupported || 0,
        summary: raw.summary || '',
        claims: raw.claims || [],
        auditPhraseMatches: raw.audit_phrase_matches || raw.auditPhraseMatches || [],
        analysisRuns: (raw.analysis_runs || raw.analysisRuns || []).map((run) => ({
            id: run.id,
            stateId: run.state_id || run.stateId || '',
            engine: run.engine || '',
            promptVersion: run.prompt_version || run.promptVersion || '',
            resumeFingerprint: run.resume_fingerprint || run.resumeFingerprint || '',
            templateFingerprint: run.template_fingerprint || run.templateFingerprint || '',
            recommendationScore: run.recommendation_score ?? run.recommendationScore ?? 0,
            fitScore: run.fit_score ?? run.fitScore ?? 0,
            evidenceScore: run.evidence_score ?? run.evidenceScore ?? 0,
            githubMatchScore: run.github_match_score ?? run.githubMatchScore ?? 0,
            reviewerScore: run.reviewer_score ?? run.reviewerScore ?? 0,
            supported: run.supported || 0,
            stretched: run.stretched || 0,
            unsupported: run.unsupported || 0,
            promptTokens: run.prompt_tokens || run.promptTokens || 0,
            completionTokens: run.completion_tokens || run.completionTokens || 0,
            estimatedCostUsd: run.estimated_cost_usd || run.estimatedCostUsd || 0,
            triggeredBy: run.triggered_by || run.triggeredBy || 'System',
            createdAt: run.created_at || run.createdAt || '',
        })),
    };
}

export function normaliseUser(raw) {
    return {
        id: raw.id,
        username: raw.username,
        email: raw.email,
        fullName: raw.full_name || raw.fullName || '',
        country: raw.country || '',
        address: raw.address || '',
        organization: raw.organization || '',
        role: raw.role || 'user',
        emailVerified: raw.email_verified ?? raw.emailVerified ?? true,
        messageNotificationsEnabled: raw.message_notifications_enabled ?? raw.messageNotificationsEnabled ?? true,
        messageNotificationsMutedUntil: raw.message_notifications_muted_until ?? raw.messageNotificationsMutedUntil ?? null,
    };
}

export function normaliseWorkflow(raw = {}) {
    const summary = raw.vote_summary || raw.voteSummary || {};
    return {
        status: raw.status || 'Unreviewed',
        voteSummary: {
            average: summary.average || '0.0',
            downvotes: summary.downvotes || 0,
            stars: summary.stars || 0,
            starredByMe: Boolean(summary.starred_by_me ?? summary.starredByMe),
            myVote: summary.my_vote || summary.myVote || '',
            myScore: summary.my_score ?? summary.myScore ?? null,
            attribution: summary.attribution || [],
        },
        activity: raw.activity || [],
    };
}

export function normaliseMessage(raw) {
    return {
        id: String(raw.id),
        from: raw.from,
        fromName: raw.from_name || raw.fromName || '',
        to: raw.to,
        subject: raw.subject || 'No subject',
        body: raw.body || '',
        type: raw.type === 'PROJECT_INVITE' ? 'projectInvite' : 'message',
        meta: {
            inviteToken: raw.invite_token || raw.inviteToken || '',
            inviteStatus: raw.invite_status || raw.inviteStatus || '',
            projectId: raw.project_id || raw.projectId || null,
            projectTitle: raw.project_title || raw.projectTitle || '',
        },
        read: Boolean(raw.read),
        starred: Boolean(raw.starred),
        readAt: raw.read_at || raw.readAt || null,
        archived: Boolean(raw.archived),
        manualUnread: Boolean(raw.manual_unread ?? raw.manualUnread),
        deliveryStatus: raw.delivery_status || raw.deliveryStatus || 'SENT',
        replyToMessageId: raw.reply_to_message_id || raw.replyToMessageId || null,
        forwardedFromMessageId: raw.forwarded_from_message_id || raw.forwardedFromMessageId || null,
        candidateAttachments: raw.candidate_attachments || raw.candidateAttachments || [],
        createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
        serverBacked: true,
    };
}
