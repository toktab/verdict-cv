import { lazy } from 'react';

const lazyNamed = (loader, name) =>
    lazy(() => loader().then((mod) => ({ default: mod[name] })));

export const pages = {
    HistoryPage: lazyNamed(() => import('./pages/HistoryPage'), 'HistoryPage'),
    AuthPage: lazyNamed(() => import('./pages/AuthPage'), 'AuthPage'),
    CandidateDetailPage: lazyNamed(() => import('./pages/projects/CandidateDetailPage'), 'CandidateDetailPage'),
    CandidateMatchReportPage: lazyNamed(() => import('./pages/projects/CandidateMatchReportPage'), 'CandidateMatchReportPage'),
    CandidateProfilePage: lazyNamed(() => import('./pages/projects/CandidateProfilePage'), 'CandidateProfilePage'),
    HomePage: lazyNamed(() => import('./pages/HomePage'), 'HomePage'),
    MessagesPage: lazyNamed(() => import('./pages/MessagesPage'), 'MessagesPage'),
    ProfilePage: lazyNamed(() => import('./pages/ProfilePage'), 'ProfilePage'),
    AdminPage: lazyNamed(() => import('./pages/AdminPage'), 'AdminPage'),
    AddCandidatePage: lazyNamed(() => import('./pages/projects/AddCandidatePage'), 'AddCandidatePage'),
    NewJobPage: lazyNamed(() => import('./pages/projects/NewJobPage'), 'NewJobPage'),
    ProjectDetailPage: lazyNamed(() => import('./pages/projects/ProjectDetailPage'), 'ProjectDetailPage'),
    ProjectSettingsPage: lazyNamed(() => import('./pages/projects/ProjectSettingsPage'), 'ProjectSettingsPage'),
    ProjectTeamPage: lazyNamed(() => import('./pages/projects/ProjectTeamPage'), 'ProjectTeamPage'),
    ProjectsPage: lazyNamed(() => import('./pages/projects/ProjectsPage'), 'ProjectsPage'),
    SignalTracePage: lazyNamed(() => import('./pages/projects/SignalTracePage'), 'SignalTracePage'),
    SignalTraceReportPage: lazyNamed(() => import('./pages/projects/SignalTraceReportPage'), 'SignalTraceReportPage'),
};
