// Re-export from modular API files for backward compatibility.
// New code should import directly from './api/authApi.js', './api/projectApi.js', etc.
export {
    apiRegister, apiLogin, apiMe, apiLogout,
    apiUpdateNotificationPreferences, apiListCmdSessions,
    apiCreateCmdPairingCode, apiRevokeCmdSession, apiLookupUser,
} from './api/authApi';

export {
    apiListProjects, apiListProjectsPage, apiGetProject, apiCreateProject,
    apiImportJobPostings, apiDeleteProject,
    apiGetProjectSettings, apiSaveProjectSettings,
    apiListProjectActivity, apiRecordProjectActivity,
    apiListProjectAnnouncements, apiCreateProjectAnnouncement,
    apiPinProjectAnnouncement, apiDeleteProjectAnnouncement,
    apiListProjectAtsTemplates, apiSaveProjectAtsTemplates,
    apiListProjectMemberPermissions, apiSaveProjectMemberPermissions,
    apiListProjectInvites, apiListProjectMembers,
    apiUpdateProjectMemberRole, apiRemoveProjectMember,
    apiCreateProjectInvite, apiAcceptProjectInvite,
} from './api/projectApi';

export {
    apiAddCandidate, apiListCandidates, apiUploadCandidateResume,
    apiGetCandidate, apiReanalyzeCandidate,
    apiUpdateCandidateAnalysisState, apiDeleteCandidate,
    apiRunCandidateOsint, apiGetLatestCandidateOsint,
    apiListCandidateNotes, apiCreateCandidateNote,
    apiGetCandidateWorkflow, apiVoteCandidate, apiUpdateCandidateStatus,
} from './api/candidateApi';

export {
    apiListMessages, apiListMessagesPage,
    apiCreateRealtimeTicket, apiRealtimeUrl,
    apiSendMessage, apiUpdateMessage,
} from './api/messageApi';

export {
    apiAdminLogin, apiAdminAudits, apiAdminAudit,
    apiAdminLogs, apiAdminUsers, apiAdminSettings,
    apiAdminHealth, apiAdminAtsTemplates,
    apiPublishAdminAtsTemplate, apiRollbackAdminAtsTemplate,
    apiUpdateAdminSettings, apiAdminTableClearTargets,
    apiClearAdminTables, apiAdminCreateUser,
    apiAdminUpdateUser, apiAdminDeleteUser,
    apiAdminDeleteAudit, apiAdminDeleteLog, apiAdminUpdateVerdict,
} from './api/adminApi';

export {
    apiAuditHistory, apiAuditTemplates, apiAuditStates,
    apiCreateAuditTemplate, apiRunAudit, apiExtractAuditFile, apiGetAudit,
} from './api/auditApi';

export { normaliseProject, normaliseCandidate, normaliseUser, normaliseWorkflow, normaliseMessage } from './normalizers';

// Convenience object for code that references javaApi.XXX directly.
import {
    apiAuditHistory, apiAuditTemplates, apiAuditStates,
    apiCreateAuditTemplate, apiRunAudit, apiExtractAuditFile, apiGetAudit,
} from './api/auditApi';
import {
    apiAdminLogin, apiAdminAudits, apiAdminAudit,
    apiAdminLogs, apiAdminUsers, apiAdminSettings,
    apiAdminHealth, apiAdminAtsTemplates,
    apiPublishAdminAtsTemplate, apiRollbackAdminAtsTemplate,
    apiUpdateAdminSettings, apiAdminTableClearTargets,
    apiClearAdminTables, apiAdminCreateUser,
    apiAdminUpdateUser, apiAdminDeleteUser,
    apiAdminDeleteAudit, apiAdminDeleteLog, apiAdminUpdateVerdict,
} from './api/adminApi';
import { apiUpdateMe } from './api/authApi';

export const javaApi = {
    history: apiAuditHistory,
    templates: apiAuditTemplates,
    states: apiAuditStates,
    createTemplate: apiCreateAuditTemplate,
    runAudit: apiRunAudit,
    extractAuditFile: apiExtractAuditFile,
    getAudit: apiGetAudit,
    updateMe: apiUpdateMe,
    adminLogin: apiAdminLogin,
    adminAudits: apiAdminAudits,
    adminAudit: apiAdminAudit,
    adminLogs: apiAdminLogs,
    adminUsers: apiAdminUsers,
    adminSettings: apiAdminSettings,
    adminHealth: apiAdminHealth,
    adminAtsTemplates: apiAdminAtsTemplates,
    publishAdminAtsTemplate: apiPublishAdminAtsTemplate,
    rollbackAdminAtsTemplate: apiRollbackAdminAtsTemplate,
    updateAdminSettings: apiUpdateAdminSettings,
    adminTableClearTargets: apiAdminTableClearTargets,
    clearAdminTables: apiClearAdminTables,
    createUser: apiAdminCreateUser,
    updateUser: apiAdminUpdateUser,
    deleteUser: apiAdminDeleteUser,
    deleteAudit: apiAdminDeleteAudit,
    deleteLog: apiAdminDeleteLog,
    updateVerdict: apiAdminUpdateVerdict,
};
