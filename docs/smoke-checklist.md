# VERDICT Manual Smoke Checklist

Run this checklist against a clean browser session and repeat the project/team sections with both an owner account and an invited member account.

## Route stability

- Open `/`, `/login`, `/register`, `/dashboard`, `/projects`, `/history`, `/messages`, `/profile`, `/audit`, and `/admin` directly in a new tab.
- Refresh every authenticated route after login. The route must render a loading, empty, content, forbidden, or error state without a blank page.
- Use browser Back and Forward after navigating among Dashboard, Projects, History, and Messages. The visible page and URL must stay synchronized.
- Open an unknown URL such as `/does-not-exist`. Confirm the Not Found state offers Home or Dashboard, Projects when signed in, and Reload.
- Trigger a display error in development and confirm the recovery view offers Dashboard, Projects, Reload route, and Logout.

## Projects and candidates

- Open an existing project, a deleted project URL, and a project ID the account cannot access.
- Open Team, Settings, Add Candidate, Candidate Detail, Match Report, Profiling, and SignalTrace by direct URL and refresh each route.
- Delete a candidate, then revisit its old URL. Confirm a candidate-not-found state appears instead of Recovery or raw JSON.
- Delete a project as Head Admin and verify it disappears for the owner and invited account without refreshing.

## Authentication and permissions

- Visit authenticated routes while logged out. Confirm the app presents a login or forbidden state and does not expose private data.
- Expire or invalidate the session, then perform a protected action. Confirm the app clears the session and shows the authentication-problem login message.
- As an invited member, confirm Team and project actions match `myRole` and `myPermissions` returned by the server.
- As a user without team-management permission, confirm member details remain visible but invite and management actions are unavailable.

## Messages and audits

- Open Messages with an empty inbox, a populated inbox, and a failed network request. Confirm empty, loading, and retry states.
- Send, reply, and forward between two accounts. Confirm inbox, sent, read, unread, and starred state survives refresh.
- Open an existing audit and a missing audit by direct URL. Confirm loading, content, and not-found states render without Recovery.
- Start an audit, refresh while it is processing, then verify progress resumes or an actionable retry state appears.

## Responsive and keyboard checks

- Repeat the highest-value routes at 390 x 844 and 1440 x 900. Confirm no controls overlap or clip.
- Navigate recovery, dialog, message, and project actions with Tab and Shift+Tab. Confirm focus remains visible.
- Open dialogs and verify Escape closes non-destructive dialogs without submitting an action.
