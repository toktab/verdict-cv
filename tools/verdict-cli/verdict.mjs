#!/usr/bin/env node

import { createInterface } from 'node:readline/promises';
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, createWriteStream, renameSync, unlinkSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { homedir, hostname, platform } from 'node:os';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

const VERSION = '1.1.0';
const USER_AGENT = `VERDICT-CLI/${VERSION} ${platform()}`;
const CONFIG_DIR = process.env.APPDATA ? join(process.env.APPDATA, 'VERDICT') : join(homedir(), '.verdict');
const CONFIG_FILE = join(CONFIG_DIR, 'cli-config.json');
const CREDENTIAL_FILE = join(CONFIG_DIR, 'credentials.json');
const LOG_DIR = process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'VERDICT', 'logs') : join(CONFIG_DIR, 'logs');
const LOG_FILE = join(LOG_DIR, `verdict-${new Date().toISOString().slice(0, 10)}.jsonl`);
const EXIT = { GENERAL: 1, ARGUMENT: 2, AUTH: 3, FORBIDDEN: 4, NOT_FOUND: 5, CONFLICT: 6, VALIDATION: 7, NETWORK: 8, TIMEOUT: 9, JOB: 10, DECLINED: 11, PARTIAL: 12, VERSION: 13, FILE: 14, RATE_LIMIT: 15 };

const { args, options } = parseArguments(process.argv.slice(2));
const config = loadConfig();
const profileName = String(options.profile || process.env.VERDICT_PROFILE || config.activeProfile || 'local');
const profile = config.profiles[profileName] || { server: 'http://localhost:8080', output: 'table', color: 'auto', editor: 'notepad' };
const server = trimSlash(String(options.server || process.env.VERDICT_SERVER || profile.server || 'http://localhost:8080'));
const outputFormat = String(options.output || process.env.VERDICT_OUTPUT || profile.output || 'table').toLowerCase();
const colorEnabled = !options['no-color'] && !process.env.NO_COLOR && process.stdout.isTTY && profile.color !== 'never';

logEvent('command.started', { args: sanitizeArguments(process.argv.slice(2)), version: VERSION, platform: platform() });
main()
    .then(() => logEvent('command.completed', { exitCode: process.exitCode || 0 }))
    .catch((error) => {
        logEvent('command.failed', { message: error.message || String(error), code: error.code || EXIT.GENERAL });
        fail(error);
    });

async function main() {
    const command = args[0] || 'startup';
    if (options.version || command === 'version') return versionCommand();
    if (options.help || command === 'help') return help(args[1]);
    if (command === 'setup') return setup();
    if (command === 'config') return configCommand(args.slice(1));
    if (command === 'profile') return profileCommand(args.slice(1));
    if (command === 'login') return login(false);
    if (command === 'connect' || command === 'pair') return connectWithCode(args[1]);
    if (command === 'logout') return logout(false);
    if (command === 'whoami') return whoami();
    if (command === 'session') return sessionCommand(args.slice(1));
    if (command === 'doctor') return doctor();
    if (command === 'logs') return logsCommand(args.slice(1));
    if (command === 'health' || command === 'ping') return health();
    if (command === 'dashboard') return dashboard();
    if (command === 'shell') return interactiveShell();
    if (command === 'reports' || command === 'report') return reportsCommand(args.slice(1));
    if (command === 'notifications') return notificationsCommand(args.slice(1));
    if (command === 'batch') return batchCommand(args.slice(1));
    if (command === 'open') return openWebsite(args.slice(1));
    if (command === 'watch') return watch(options.type || args[1] || 'all');
    if (command === 'projects' || command === 'project') return projectsCommand(args.slice(1));
    if (command === 'candidates' || command === 'candidate') return candidatesCommand(args.slice(1));
    if (command === 'audits' || command === 'audit') return auditsCommand(args.slice(1));
    if (command === 'messages' || command === 'message') return messagesCommand(args.slice(1));
    if (command === 'team') return teamCommand(args.slice(1));
    if (command === 'activity') return activityCommand(args.slice(1));
    if (command === 'announcements' || command === 'announcement') return announcementsCommand(args.slice(1));
    if (command === 'ats') return atsCommand(args.slice(1));
    if (command === 'signaltrace' || command === 'osint') return signalTraceCommand(args.slice(1));
    if (command === 'admin') return adminCommand(args.slice(1));
    if (command === 'startup') return startupCommand();
    if (command === 'update') return updateCommand();
    throw cliError(`Unknown command: ${command}. Run "verdict help".`, EXIT.ARGUMENT);
}

async function startupCommand() {
    const isSea = typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('.exe');
    const runtime = isSea ? `standalone executable (${platform()})` : `Node.js ${process.version} (${platform()})`;

    console.log(`\n  ${paint('VERDICT CLI', 'red')}  ${paint(VERSION, 'bold')}`);
    console.log(`  ${paint('Confidence is not evidence.', 'muted')}`);
    console.log('');
    console.log(`  Runtime: ${runtime}`);
    console.log(`  Profile: ${profileName} ${paint('→', 'muted')} ${server}`);

    // Quick async update check (2s timeout — non-blocking feel)
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);
        const response = await fetch(`${server}/api/system/cli/version`, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok) {
            const versionInfo = await response.json();
            if (versionInfo.version && versionInfo.version !== VERSION) {
                console.log(`\n  ${paint('UPDATE AVAILABLE', 'amber')}  ${VERSION} ${paint('→', 'muted')} ${versionInfo.version}`);
                console.log(`  Run ${paint('verdict update', 'green')} to upgrade.`);
            } else {
                console.log(`\n  ${paint('UP TO DATE', 'green')}  verdict ${VERSION} is the latest version.`);
            }
        } else {
            console.log(`\n  ${paint('UPDATE CHECK', 'muted')}  Server did not provide version info.`);
        }
    } catch {
        console.log(`\n  ${paint('UPDATE CHECK', 'muted')}  Could not reach server for update check.`);
    }

    // Check session status
    try {
        const credentials = await loadCredentials(profileName);
        if (credentials?.accessToken && (!credentials.accessExpiresAt || Date.parse(credentials.accessExpiresAt) > Date.now())) {
            console.log(`  ${paint('SESSION', 'green')}  Signed in`);
        } else {
            console.log(`  ${paint('SESSION', 'amber')}  Not signed in`);
        }
    } catch {
        console.log(`  ${paint('SESSION', 'muted')}  Unknown`);
    }

    console.log('');
    console.log(`  ${paint('QUICK START', 'amber')}`);
    console.log(`    verdict connect ABCD-EFGH    Pair with VERDICT Profile`);
    console.log(`    verdict login                Sign in with password`);
    console.log(`    verdict dashboard            Terminal workspace overview`);
    console.log(`    verdict help                 All commands and options`);
    console.log('');
}

function help(topic = '') {
    const groups = {
        projects: 'list, show, create, delete, open',
        candidates: 'list, show, upload, add, analyze, status, note, vote, delete, open',
        audits: 'list, show, run, watch, cancel, export, open',
        messages: 'list, show, send, reply, forward, read, unread, star, archive, watch',
        team: 'list, invites, invite, accept, role, kick',
        activity: 'list, export, watch',
        announcements: 'list, post, pin, unpin, delete',
        ats: 'list, show, export, import, validate',
        signaltrace: 'run, show',
        admin: 'login, logout, health, users, audits, logs, settings, clear-targets, clear',
    };
    if (topic && groups[topic]) {
        console.log(`verdict ${topic} <action>\n\nActions: ${groups[topic]}\nRun a command with --help for its options.`);
        return;
    }
    console.log(`${paint('VERDICT CLI', 'red')} ${VERSION}
Confidence is not evidence.

Usage:
  verdict <command> [action] [options]

Start:
  verdict setup
  verdict connect ABCD-EFGH
  verdict login
  verdict whoami
  verdict doctor
  verdict logs path|open

Resources:
${Object.entries(groups).map(([name, actions]) => `  ${name.padEnd(15)} ${actions}`).join('\n')}

Other:
  dashboard, shell, reports, notifications, batch, update
  health, watch, open, config, profile, session, version, help

Global options:
  --profile NAME   --server URL   --output table|json|jsonl|csv|text|quiet
  --search TEXT    --page N       --size N       --fields a,b,c
  --dry-run        --yes          --no-color     --verbose

Examples:
  verdict projects list --search backend
  verdict candidates upload --project 12 --file "C:\\CVs\\nino.pdf"
  verdict messages send --to reviewer --subject "Review" --body "Please check 44"
  verdict audits run --claim-file cv.txt --evidence-file job.txt
  verdict watch messages
`);
}

async function setup() {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const name = (await rl.question(`Profile name [${profileName}]: `)).trim() || profileName;
    const url = (await rl.question(`Server URL [${server}]: `)).trim() || server;
    const output = (await rl.question('Default output [table]: ')).trim() || 'table';
    rl.close();
    config.activeProfile = name;
    config.profiles[name] = { server: trimSlash(url), output, color: 'auto', editor: 'notepad' };
    saveConfig(config);
    success(`Profile "${name}" saved. Run "verdict login".`);
}

function configCommand(parts) {
    const action = parts[0] || 'list';
    if (action === 'path') return console.log(CONFIG_FILE);
    if (action === 'list') return output({ activeProfile: config.activeProfile, profile: config.profiles[profileName] || profile });
    if (action === 'set') {
        const key = parts[1];
        const value = parts.slice(2).join(' ');
        if (!['server', 'output', 'color', 'editor'].includes(key) || !value) throw cliError('Usage: verdict config set server|output|color|editor VALUE', EXIT.ARGUMENT);
        config.profiles[profileName] = { ...profile, [key]: key === 'server' ? trimSlash(value) : value };
        saveConfig(config);
        return success(`${key} updated for ${profileName}.`);
    }
    throw cliError('Usage: verdict config list|path|set', EXIT.ARGUMENT);
}

function profileCommand(parts) {
    const action = parts[0] || 'list';
    if (action === 'list') return output(Object.entries(config.profiles).map(([name, value]) => ({ name, active: name === config.activeProfile, server: value.server, output: value.output })));
    if (action === 'use') {
        const name = parts[1];
        if (!config.profiles[name]) throw cliError(`Profile not found: ${name}`, EXIT.NOT_FOUND);
        config.activeProfile = name;
        saveConfig(config);
        return success(`Active profile: ${name}`);
    }
    if (action === 'add') {
        const name = parts[1];
        const url = options.server;
        if (!name || !url) throw cliError('Usage: verdict profile add NAME --server URL', EXIT.ARGUMENT);
        config.profiles[name] = { server: trimSlash(String(url)), output: 'table', color: 'auto', editor: 'notepad' };
        saveConfig(config);
        return success(`Profile "${name}" added.`);
    }
    if (action === 'remove') {
        const name = parts[1];
        if (!name || name === config.activeProfile) throw cliError('Select another active profile before removing this one.', EXIT.CONFLICT);
        delete config.profiles[name];
        saveConfig(config);
        return success(`Profile "${name}" removed.`);
    }
    throw cliError('Usage: verdict profile list|use|add|remove', EXIT.ARGUMENT);
}

async function login(admin = false) {
    const identifier = String(options.user || options.username || await prompt('Username or email: ')).trim();
    const password = process.env.VERDICT_PASSWORD || await secretPrompt('Password: ');
    if (!identifier || !password) throw cliError('Username/email and password are required.', EXIT.VALIDATION);
    const path = admin ? '/api/admin/login' : '/api/auth/cli/login';
    const body = admin
        ? { username: identifier, password }
        : { identifier, password, clientName: String(options.name || `${hostname()} CMD`) };
    const response = await rawRequest('POST', path, body, { publicRequest: true, admin });
    persistSelectedServer();
    await storeCredentials(admin ? `admin:${profileName}` : profileName, admin
        ? { accessToken: response.token }
        : { accessToken: response.access_token || response.token, refreshToken: response.refresh_token, accessExpiresAt: response.access_expires_at, refreshExpiresAt: response.refresh_expires_at });
    if (admin) return success(`Admin session connected to ${server}.`);
    success(`Signed in as ${response.user?.fullName || response.user?.username} (${response.user?.username}) on ${profileName}.`);
}

async function connectWithCode(value) {
    const code = String(value || options.code || await prompt('Pairing code from Profile: ')).trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{4}-?[A-HJ-NP-Z2-9]{4}$/.test(code)) {
        throw cliError('Pairing code must look like ABCD-EFGH.', EXIT.VALIDATION);
    }
    const clientName = String(options.name || `${hostname()} CMD`);
    const response = await rawRequest('POST', '/api/auth/cli/pair', { code, clientName }, { publicRequest: true });
    persistSelectedServer();
    await storeCredentials(profileName, {
        accessToken: response.access_token || response.token,
        refreshToken: response.refresh_token,
        accessExpiresAt: response.access_expires_at,
        refreshExpiresAt: response.refresh_expires_at,
    });
    success(`Connected ${clientName} as ${response.user?.fullName || response.user?.username} on ${profileName}.`);
    if (outputFormat !== 'quiet') console.log(`Run "verdict dashboard" to open your terminal workspace.`);
}

async function logout(admin = false) {
    const key = admin ? `admin:${profileName}` : profileName;
    const credentials = await loadCredentials(key);
    if (!admin && credentials?.accessToken && options.all) {
        const sessions = await api('GET', '/api/auth/me/cmd-sessions').catch(() => []);
        await Promise.all(sessions.filter((session) => session.active).map((session) => api('DELETE', `/api/auth/me/cmd-sessions/${session.id}`).catch(() => null)));
    } else if (!admin && credentials?.accessToken) {
        await rawRequest('POST', '/api/auth/logout', {}, { token: credentials.accessToken }).catch(() => null);
    }
    await removeCredentials(key);
    success(`${admin ? 'Admin' : 'User'} session removed from this computer.`);
}

async function whoami() {
    const user = await api('GET', '/api/auth/me');
    output({ name: user.fullName, username: user.username, email: user.email, role: user.role, organization: user.organization, profile: profileName, server });
}

async function sessionCommand(parts) {
    const action = parts[0] || 'status';
    if (action === 'status') return whoami();
    if (action === 'refresh') {
        await refreshSession(true);
        return success('Session refreshed.');
    }
    if (action === 'clear') return logout(false);
    if (action === 'list') return output(await api('GET', '/api/auth/me/cmd-sessions'));
    if (action === 'revoke') {
        const id = required(parts[1], 'Session ID is required.');
        await api('DELETE', `/api/auth/me/cmd-sessions/${encodeURIComponent(id)}`);
        return success('CMD session revoked.');
    }
    throw cliError('Usage: verdict session status|refresh|clear|list|revoke', EXIT.ARGUMENT);
}

async function health() {
    const started = Date.now();
    const data = await rawRequest('GET', '/api/system/health', undefined, { publicRequest: true });
    data.responseMillis = Date.now() - started;
    output(data);
}

async function doctor() {
    const checks = [];
    checks.push({ check: 'Configuration', status: existsSync(CONFIG_FILE) ? 'PASS' : 'WARN', detail: existsSync(CONFIG_FILE) ? CONFIG_FILE : 'Using defaults; run verdict setup' });
    try {
        const started = Date.now();
        const result = await rawRequest('GET', '/api/system/health', undefined, { publicRequest: true });
        checks.push({ check: 'Server', status: 'PASS', detail: `${server} / ${Date.now() - started} ms` });
        checks.push({ check: 'Database', status: result.database?.status || 'UNKNOWN', detail: result.database?.detail || '' });
        checks.push({ check: 'RabbitMQ', status: result.rabbitmq?.status || 'UNKNOWN', detail: result.rabbitmq?.detail || 'Optional' });
    } catch (error) {
        checks.push({ check: 'Server', status: 'FAIL', detail: error.message });
    }
    try {
        const user = await api('GET', '/api/auth/me');
        checks.push({ check: 'User session', status: 'PASS', detail: user.username });
    } catch (error) {
        checks.push({ check: 'User session', status: 'WARN', detail: 'Run verdict login' });
    }
    checks.push({ check: 'Credential protection', status: platform() === 'win32' ? 'PASS' : 'WARN', detail: platform() === 'win32' ? 'Windows DPAPI' : 'User-only credential file' });
    checks.push({ check: 'Diagnostic log', status: 'PASS', detail: LOG_FILE });
    output(checks);
    if (checks.some((row) => row.status === 'FAIL')) process.exitCode = EXIT.NETWORK;
}

function logsCommand(parts) {
    const action = parts[0] || 'path';
    mkdirSync(LOG_DIR, { recursive: true });
    if (action === 'path') return output({ directory: LOG_DIR, currentLog: LOG_FILE });
    if (action === 'open') {
        if (platform() !== 'win32') throw cliError('Log folder opening is currently supported on Windows.', EXIT.ARGUMENT);
        spawn('explorer.exe', [LOG_DIR], { detached: true, stdio: 'ignore' }).unref();
        return success(`Opened ${LOG_DIR}`);
    }
    throw cliError('Usage: verdict logs path|open', EXIT.ARGUMENT);
}

async function dashboard() {
    const [system, user, projects, messages, audits] = await Promise.all([
        rawRequest('GET', '/api/system/health', undefined, { publicRequest: true }),
        api('GET', '/api/auth/me'),
        api('GET', '/api/projects/page?page=0&size=5&search='),
        api('GET', '/api/messages/page?page=0&size=20&search='),
        api('GET', '/api/audit/history'),
    ]);
    const messageRows = messages.items || messages;
    const auditRows = audits.items || audits;
    output({
        server,
        health: system.status || 'UNKNOWN',
        signedInAs: user.username,
        projects: projects.total ?? projects.totalElements ?? (projects.items || projects).length,
        unreadMessages: messageRows.filter((row) => !row.read && !row.read_at).length,
        recentAudits: auditRows.length,
        latestAudit: auditRows[0]?.status || 'None',
    });
}

async function interactiveShell() {
    const user = await api('GET', '/api/auth/me');
    const rl = createInterface({ input: process.stdin, output: process.stdout, historySize: 200 });
    console.log(`VERDICT shell connected to ${profileName} as ${user.username}. Type "help" or "exit".`);
    while (true) {
        const line = (await rl.question(`VERDICT [${profileName} / ${user.username}] > `)).trim();
        if (!line) continue;
        if (['exit', 'quit'].includes(line.toLowerCase())) break;
        const childArgs = splitCommandLine(line);
        const result = spawnSync(process.execPath, [process.argv[1], '--profile', profileName, ...childArgs], { stdio: 'inherit' });
        if (result.error) console.error(`${paint('ERROR', 'red')} ${result.error.message}`);
    }
    rl.close();
}

async function reportsCommand(parts) {
    const action = parts[0] || 'audit';
    if (action === 'audit') return auditsCommand(['export', required(parts[1], 'Audit ID is required.')]);
    if (action === 'candidate') {
        const project = required(options.project, '--project is required.');
        const candidate = required(options.candidate, '--candidate is required.');
        if (options.open || !options.format) return openWebsite(['candidate', project, candidate]);
        const data = await api('GET', `/api/projects/${project}/candidates/${candidate}`);
        return writeExport(options.out || `candidate-${candidate}.json`, JSON.stringify(data, null, 2));
    }
    if (action === 'project') {
        const project = required(options.project, '--project is required.');
        const rows = await api('GET', `/api/projects/${project}/candidates?offset=0&limit=${numberOption('size', 500)}`);
        return writeExport(options.out || `project-${project}-candidates.csv`, toCsv(rows.items || rows));
    }
    if (action === 'open') {
        const file = resolve(required(parts[1], 'Report path is required.'));
        if (!existsSync(file)) throw cliError(`Report not found: ${file}`, EXIT.FILE);
        const command = platform() === 'win32' ? ['cmd.exe', ['/c', 'start', '', file]] : platform() === 'darwin' ? ['open', [file]] : ['xdg-open', [file]];
        spawn(command[0], command[1], { detached: true, stdio: 'ignore' }).unref();
        return success(`Opened ${file}`);
    }
    throw cliError('Usage: verdict reports audit ID|candidate --project ID --candidate ID|project --project ID|open FILE', EXIT.ARGUMENT);
}

async function notificationsCommand(parts) {
    const action = parts[0] || 'status';
    if (action === 'status') {
        const user = await api('GET', '/api/auth/me');
        return output({ enabled: user.messageNotificationsEnabled, mutedUntil: user.messageNotificationsMutedUntil || null });
    }
    if (action === 'unmute') return output(await api('PATCH', '/api/auth/me/notifications', { enabled: true, mutedUntil: null }));
    if (action === 'mute') {
        const duration = required(parts[1], 'Use 15m, 1h, or forever.').toLowerCase();
        const durations = { '5m': 5 * 60_000, '15m': 15 * 60_000, '1h': 60 * 60_000 };
        if (duration !== 'forever' && !durations[duration]) throw cliError('Use 5m, 15m, 1h, or forever.', EXIT.ARGUMENT);
        const mutedUntil = duration === 'forever' ? null : new Date(Date.now() + durations[duration]).toISOString();
        return output(await api('PATCH', '/api/auth/me/notifications', { enabled: duration !== 'forever', mutedUntil }));
    }
    throw cliError('Usage: verdict notifications status|mute 5m|15m|1h|forever|unmute', EXIT.ARGUMENT);
}

async function batchCommand(parts) {
    const action = parts[0] || 'run';
    if (action !== 'run') throw cliError('Usage: verdict batch run workflow.json', EXIT.ARGUMENT);
    const file = resolve(required(parts[1] || options.file, 'Workflow JSON file is required.'));
    const workflow = JSON.parse(readTextFile(file));
    const steps = Array.isArray(workflow) ? workflow : workflow.steps;
    if (!Array.isArray(steps) || !steps.length) throw cliError('Workflow must contain a non-empty steps array.', EXIT.VALIDATION);
    for (let index = 0; index < steps.length; index += 1) {
        const step = typeof steps[index] === 'string' ? steps[index] : steps[index].command;
        if (!step) throw cliError(`Workflow step ${index + 1} has no command.`, EXIT.VALIDATION);
        console.error(`${paint('STEP', 'red')} ${index + 1}/${steps.length}: ${step}`);
        if (options['dry-run']) continue;
        const result = spawnSync(process.execPath, [process.argv[1], '--profile', profileName, ...splitCommandLine(step)], { stdio: 'inherit' });
        if (result.status !== 0) throw cliError(`Workflow stopped at step ${index + 1} with exit code ${result.status}.`, result.status || EXIT.JOB);
    }
    success(`${steps.length} workflow steps completed.`);
}

function versionCommand() {
    const details = { cliVersion: VERSION, profile: profileName, server };
    if (['json', 'jsonl', 'csv', 'quiet'].includes(outputFormat)) return output(details);
    console.log(`${paint('VERDICT CLI', 'red')} ${VERSION}`);
    console.log(`Profile: ${profileName}`);
    console.log(`Server:  ${server}`);
}

function openWebsite(parts) {
    const resource = parts[0] || 'home';
    const routes = {
        home: '/', dashboard: '/dashboard', projects: '/projects', messages: '/messages', history: '/history', admin: '/admin', profile: '/profile',
        project: `/projects/${parts[1] || ''}`,
        candidate: `/projects/${parts[1] || ''}/candidates/${parts[2] || ''}`,
        audit: `/audit/${parts[1] || ''}`,
    };
    const url = `${server}${routes[resource] ?? `/${resource}`}`;
    const command = platform() === 'win32' ? ['cmd.exe', ['/c', 'start', '', url]] : platform() === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawn(command[0], command[1], { detached: true, stdio: 'ignore' }).unref();
    success(`Opened ${url}`);
}

async function projectsCommand(parts) {
    const action = parts[0] || 'list';
    if (action === 'list') {
        const query = queryString({ page: zeroPage(), size: numberOption('size', 25), search: options.search || '' });
        const data = await api('GET', `/api/projects/page?${query}`);
        let rows = data.items || data;
        if (options.mine) rows = rows.filter((row) => /owner|head admin/i.test(`${row.access || ''} ${row.myRole || ''}`));
        if (options.invited) rows = rows.filter((row) => /invited/i.test(`${row.access || ''} ${row.accessLabel || ''}`));
        if (options.role) rows = rows.filter((row) => String(row.myRole || row.role || '').toLowerCase() === String(options.role).toLowerCase());
        return output(rows);
    }
    if (action === 'show' || action === 'status') return output(await api('GET', `/api/projects/${required(parts[1], 'Project ID is required.')}`));
    if (action === 'open') return openWebsite(['project', required(parts[1], 'Project ID is required.')]);
    if (action === 'create') {
        const title = String(options.title || await prompt('Project title: ')).trim();
        const description = options['from-file'] ? readTextFile(options['from-file']) : String(options.description || await prompt('Description: '));
        const body = { title, department: options.department || 'Hiring', location: options.location || 'Remote', description, requirements: splitList(options.requirements), state: options.state || 'WAR+AI State', status: options.status || 'Screening' };
        preview('CREATE PROJECT', body);
        if (options['dry-run']) return;
        output(await api('POST', '/api/projects', body));
        return;
    }
    if (action === 'delete') {
        const id = required(parts[1], 'Project ID is required.');
        const project = await api('GET', `/api/projects/${id}`);
        await typedConfirmation(`Delete project #${id} ${project.title} and revoke all shared access`, 'I confirm');
        await api('DELETE', `/api/projects/${id}`);
        return success(`Project #${id} deleted.`);
    }
    throw cliError('Usage: verdict projects list|show|create|delete|open', EXIT.ARGUMENT);
}

async function candidatesCommand(parts) {
    const action = parts[0] || 'list';
    const projectId = String(options.project || parts[action === 'show' || action === 'delete' || action === 'analyze' ? 1 : 2] || '');
    if (action === 'list') {
        const id = required(options.project, '--project is required.');
        const query = queryString({ offset: (zeroPage()) * numberOption('size', 25), limit: numberOption('size', 25) });
        const data = await api('GET', `/api/projects/${id}/candidates?${query}`);
        return output(data.items || data);
    }
    if (action === 'show') return output(await api('GET', `/api/projects/${required(options.project, '--project is required.')}/candidates/${required(options.candidate || parts[1], 'Candidate ID is required.')}`));
    if (action === 'open') return openWebsite(['candidate', required(options.project, '--project is required.'), required(options.candidate || parts[1], 'Candidate ID is required.')]);
    if (action === 'upload') {
        const id = required(options.project, '--project is required.');
        const file = required(options.file, '--file is required.');
        const path = resolve(String(file));
        validateResume(path);
        const form = new FormData();
        form.append('name', String(options.name || basename(path, extname(path))));
        form.append('role', String(options.role || 'Candidate'));
        form.append('resume', new Blob([readFileSync(path)]), basename(path));
        if (options['dry-run']) return preview('UPLOAD CANDIDATE', { project: id, file: path });
        return output(await api('POST', `/api/projects/${id}/candidates/upload`, form, { multipart: true }));
    }
    if (action === 'add') {
        const id = required(options.project, '--project is required.');
        const body = { name: options.name || await prompt('Candidate name: '), role: options.role || 'Candidate', cv_text: options['cv-file'] ? readTextFile(options['cv-file']) : options.cv || '' };
        return output(await api('POST', `/api/projects/${id}/candidates`, body));
    }
    const candidateId = required(options.candidate || parts[1], 'Candidate ID is required.');
    const id = required(options.project || projectId, '--project is required.');
    if (action === 'analyze') return output(await api('POST', `/api/projects/${id}/candidates/${candidateId}/reanalyze`, {}));
    if (action === 'status') return output(await api('PATCH', `/api/projects/${id}/candidates/${candidateId}/status`, { status: required(options.set, '--set status is required.') }));
    if (action === 'note') return output(await api('POST', `/api/projects/${id}/candidates/${candidateId}/notes`, { type: options.type || 'NOTE', decision: options.decision || '', body: options.body || await prompt('Note: ') }));
    if (action === 'vote') return output(await api('POST', `/api/projects/${id}/candidates/${candidateId}/votes`, { action: options.action || 'SCORE', score: Number(required(options.score, '--score is required.')) }));
    if (action === 'delete') {
        const candidate = await api('GET', `/api/projects/${id}/candidates/${candidateId}`);
        await typedConfirmation(`Delete candidate ${candidate.name} from project #${id}`, 'DELETE');
        await api('DELETE', `/api/projects/${id}/candidates/${candidateId}`);
        return success('Candidate deleted.');
    }
    throw cliError('Usage: verdict candidates list|show|upload|add|analyze|status|note|vote|delete|open', EXIT.ARGUMENT);
}

async function auditsCommand(parts) {
    const action = parts[0] || 'list';
    if (action === 'list') return output(await api('GET', '/api/audit/history'));
    if (action === 'show') return output(await api('GET', `/api/audit/${required(parts[1], 'Audit ID is required.')}`));
    if (action === 'open') return openWebsite(['audit', required(parts[1], 'Audit ID is required.')]);
    if (action === 'run') {
        const body = {
            claimTitle: options['claim-title'] || 'Candidate claim', evidenceTitle: options['evidence-title'] || 'Evidence',
            claimText: options['claim-file'] ? readTextFile(options['claim-file']) : options.claim || await prompt('Claim/CV text: '),
            evidenceText: options['evidence-file'] ? readTextFile(options['evidence-file']) : options.evidence || await prompt('Evidence/job text: '),
            templateId: options.template || null, checkState: options.state || null,
        };
        const queued = await api('POST', '/api/audit/run-async', body);
        success(`Audit #${queued.id} queued.`);
        if (!options['no-wait']) return waitForAudit(queued.id);
        return output(queued);
    }
    if (action === 'watch') return waitForAudit(required(parts[1], 'Audit ID is required.'));
    if (action === 'cancel') return output(await api('POST', `/api/audit/${required(parts[1], 'Audit ID is required.')}/cancel`, {}));
    if (action === 'export') {
        const id = required(parts[1], 'Audit ID is required.');
        const format = String(options.format || 'pdf');
        return download(`/api/audit/${id}/export?format=${encodeURIComponent(format)}`, options.out || `audit-${id}.${format}`);
    }
    throw cliError('Usage: verdict audits list|show|run|watch|cancel|export|open', EXIT.ARGUMENT);
}

async function messagesCommand(parts) {
    const action = parts[0] || 'list';
    if (action === 'list') {
        const query = queryString({ page: zeroPage(), size: numberOption('size', 25), search: options.search || '' });
        const data = await api('GET', `/api/messages/page?${query}`);
        return output(filterMessages(data.items || data, options.folder));
    }
    if (action === 'show') {
        const rows = await api('GET', '/api/messages');
        const found = rows.find((message) => String(message.id) === String(parts[1]));
        if (!found) throw cliError('Message not found.', EXIT.NOT_FOUND);
        return output(found);
    }
    if (action === 'send') return sendMessage({});
    if (action === 'reply' || action === 'forward') {
        const id = required(parts[1], 'Message ID is required.');
        const rows = await api('GET', '/api/messages');
        const original = rows.find((message) => String(message.id) === String(id));
        if (!original) throw cliError('Message not found.', EXIT.NOT_FOUND);
        return action === 'reply'
            ? sendMessage({ to: original.from, subject: prefixSubject('Re:', original.subject), body: `\n\n> ${String(original.body).replace(/\n/g, '\n> ')}`, reply_to_message_id: Number(id) })
            : sendMessage({ subject: prefixSubject('Fwd:', original.subject), body: `\n\nForwarded from ${original.from}:\n${original.body}`, forwarded_from_message_id: Number(id) });
    }
    if (action === 'watch') return watch('messages');
    if (action === 'mark-all-read') {
        const rows = filterMessages(await api('GET', '/api/messages'), options.folder || 'inbox').filter((message) => !message.read);
        if (options['dry-run']) return preview('MARK ALL READ', { folder: options.folder || 'inbox', messages: rows.length });
        await Promise.all(rows.map((message) => api('PATCH', `/api/messages/${message.id}`, { read: true, manual_unread: false })));
        return success(`${rows.length} messages marked as read.`);
    }
    const id = required(parts[1], 'Message ID is required.');
    const patches = { read: { read: true, manual_unread: false }, unread: { read: false, manual_unread: true }, star: { starred: true }, unstar: { starred: false }, archive: { archived: true } };
    if (patches[action]) return output(await api('PATCH', `/api/messages/${id}`, patches[action]));
    throw cliError('Usage: verdict messages list|show|send|reply|forward|read|unread|star|unstar|archive|watch', EXIT.ARGUMENT);
}

async function sendMessage(defaults) {
    const body = {
        to: options.to || defaults.to || await prompt('To username/email: '),
        subject: options.subject || defaults.subject || 'No subject',
        body: options['body-file'] ? readTextFile(options['body-file']) : options.body || defaults.body || await prompt('Message: '),
        reply_to_message_id: defaults.reply_to_message_id || null,
        forwarded_from_message_id: defaults.forwarded_from_message_id || null,
        candidate_attachments: parseAttachments(options['attach-candidate']),
    };
    preview('SEND MESSAGE', { to: body.to, subject: body.subject, body: truncate(body.body, 120) });
    if (options['dry-run']) return;
    return output(await api('POST', '/api/messages', body));
}

async function teamCommand(parts) {
    const action = parts[0] || 'list';
    if (action === 'accept') return output(await api('POST', `/api/projects/invites/accept?token=${encodeURIComponent(required(options.token, '--token is required.'))}`, {}));
    const project = required(options.project, '--project is required.');
    if (action === 'list') return output(await api('GET', `/api/projects/${project}/members`));
    if (action === 'invites') return output(await api('GET', `/api/projects/${project}/invites`));
    if (action === 'invite') return output(await api('POST', `/api/projects/${project}/invites`, { email: options.user || options.email || await prompt('Username or email: '), role: options.role || 'REVIEWER' }));
    if (action === 'role') return output(await api('PATCH', `/api/projects/${project}/members/role`, { email: required(options.user || options.email, '--user or --email is required.'), role: required(options.set, '--set role is required.') }));
    if (action === 'kick') {
        const email = required(options.user || options.email, '--user or --email is required.');
        await confirm(`Remove ${email} from project #${project}?`);
        await api('DELETE', `/api/projects/${project}/members?email=${encodeURIComponent(email)}`);
        return success('Member removed and project activity recorded.');
    }
    throw cliError('Usage: verdict team list|invites|invite|accept|role|kick --project ID', EXIT.ARGUMENT);
}

async function activityCommand(parts) {
    const action = parts[0] || 'list';
    const project = required(options.project, '--project is required.');
    const rows = await api('GET', `/api/projects/${project}/activity`);
    const filtered = rows.filter((row) => !options.candidate || String(row.candidate_id || row.candidateId) === String(options.candidate)).filter((row) => !options.type || String(row.type).toLowerCase() === String(options.type).toLowerCase());
    if (action === 'list') return output(filtered);
    if (action === 'export') return writeExport(options.out || `project-${project}-activity.${options.format || 'txt'}`, options.format === 'jsonl' ? filtered.map((row) => JSON.stringify(row)).join('\n') : filtered.map((row) => `${row.created_at || row.createdAt}\t${row.type}\t${row.action}\t${row.detail || ''}`).join('\n'));
    if (action === 'watch') return watch(`project:${project}`);
    throw cliError('Usage: verdict activity list|export|watch --project ID', EXIT.ARGUMENT);
}

async function announcementsCommand(parts) {
    const action = parts[0] || 'list';
    const project = required(options.project, '--project is required.');
    if (action === 'list') return output(await api('GET', `/api/projects/${project}/announcements`));
    if (action === 'post') return output(await api('POST', `/api/projects/${project}/announcements`, { body: options['body-file'] ? readTextFile(options['body-file']) : options.body || await prompt('Announcement: '), pinned: Boolean(options.pin) }));
    const id = required(parts[1], 'Announcement ID is required.');
    if (action === 'pin' || action === 'unpin') return output(await api('PATCH', `/api/projects/${project}/announcements/${id}`, { pinned: action === 'pin' }));
    if (action === 'delete') {
        await confirm(`Delete announcement #${id}?`);
        await api('DELETE', `/api/projects/${project}/announcements/${id}`);
        return success('Announcement deleted.');
    }
    throw cliError('Usage: verdict announcements list|post|pin|unpin|delete --project ID', EXIT.ARGUMENT);
}

async function atsCommand(parts) {
    const action = parts[0] || 'list';
    const project = options.project;
    if (action === 'validate') {
        const payload = JSON.parse(readTextFile(required(parts[1] || options.file, 'Template JSON file is required.')));
        const errors = validateTemplate(payload);
        output(errors.length ? errors : [{ status: 'PASS', detail: 'Template JSON is valid.' }]);
        if (errors.length) process.exitCode = EXIT.VALIDATION;
        return;
    }
    if (!project) throw cliError('--project is required.', EXIT.ARGUMENT);
    if (action === 'list') return output(await api('GET', `/api/projects/${project}/ats-templates`));
    if (action === 'show') {
        const rows = await api('GET', `/api/projects/${project}/ats-templates`);
        return output(rows.find((row) => String(row.id) === String(parts[1]) || row.name === parts[1]) || null);
    }
    if (action === 'export') {
        const rows = await api('GET', `/api/projects/${project}/ats-templates`);
        const row = rows.find((item) => String(item.id) === String(parts[1]) || item.name === parts[1]);
        if (!row) throw cliError('ATS template not found.', EXIT.NOT_FOUND);
        return writeExport(options.out || `ats-${row.id}.json`, JSON.stringify(row, null, 2));
    }
    if (action === 'import') {
        const payload = JSON.parse(readTextFile(required(options.file, '--file is required.')));
        const templates = Array.isArray(payload) ? payload : [payload];
        return output(await api('POST', `/api/projects/${project}/ats-templates`, templates));
    }
    throw cliError('Usage: verdict ats list|show|export|import|validate', EXIT.ARGUMENT);
}

async function signalTraceCommand(parts) {
    const action = parts[0] || 'show';
    const project = required(options.project, '--project is required.');
    const candidate = required(options.candidate, '--candidate is required.');
    if (action === 'show') return output(await api('GET', `/api/projects/${project}/candidates/${candidate}`));
    if (action === 'run') {
        if (!options.consent) await typedConfirmation('Run consented public-source verification', 'CONSENT');
        return output(await api('POST', `/api/projects/${project}/candidates/${candidate}/osint/run`, { state: options.state || 'WAR_AI', checks: splitList(options.checks || 'github,portfolio,public-links'), consent: true }));
    }
    throw cliError('Usage: verdict signaltrace run|show --project ID --candidate ID', EXIT.ARGUMENT);
}

async function adminCommand(parts) {
    const action = parts[0] || 'health';
    if (action === 'login') return login(true);
    if (action === 'logout') return logout(true);
    if (action === 'health') return output(await adminApi('GET', '/api/admin/health'));
    if (['users', 'audits', 'logs'].includes(action)) {
        const query = queryString({ offset: zeroPage() * numberOption('size', 20), limit: numberOption('size', 20), search: options.search || '' });
        return output(await adminApi('GET', `/api/admin/${action}?${query}`));
    }
    if (action === 'settings') return output(await adminApi('GET', '/api/admin/settings'));
    if (action === 'clear-targets') return output(await adminApi('GET', '/api/admin/table-clear-targets'));
    if (action === 'clear') {
        const target = required(parts[1], 'Clear target is required.');
        const targets = await adminApi('GET', '/api/admin/table-clear-targets');
        const selected = targets.find((row) => row.key === target);
        if (!selected) throw cliError(`Unknown clear target: ${target}`, EXIT.NOT_FOUND);
        await typedConfirmation(`Clear ${selected.label}; affected rows: ${selected.rowCount ?? selected.rows ?? 'see server result'}`, target);
        return output(await adminApi('POST', '/api/admin/clear-tables', { targets: [target], confirmation: target }));
    }
    throw cliError('Usage: verdict admin login|logout|health|users|audits|logs|settings|clear-targets|clear', EXIT.ARGUMENT);
}

async function updateCommand() {
    const isSea = typeof process !== 'undefined' && process.argv[1] && (process.argv[1].endsWith('.exe') || process.argv[1].includes('verdict'));
    if (!isSea) {
        return success(`You are running verdict ${VERSION}. Download the latest from your VERDICT website Profile page, or re-run the installer.`);
    }
    const currentExe = resolve(process.argv[1]);
    const currentDir = dirname(currentExe);
    const backupExe = join(currentDir, `verdict.${VERSION}.exe`);

    // Fetch version info from server
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let versionInfo;
    try {
        const response = await fetch(`${server}/api/system/cli/version`, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
            signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        versionInfo = await response.json();
    } catch (error) {
        throw cliError(`Cannot check for updates: ${error.message}`, EXIT.NETWORK);
    } finally {
        clearTimeout(timeout);
    }

    if (!versionInfo.download_url) {
        throw cliError('Update information is incomplete.', EXIT.VERSION);
    }
    if (versionInfo.version === VERSION) {
        return success(`verdict ${VERSION} is the latest version.`);
    }

    success(`Update available: ${VERSION} → ${versionInfo.version}`);

    // Download the new exe to a temp location
    const tempExe = join(currentDir, `verdict-${versionInfo.version}.exe.tmp`);
    console.error(`Downloading verdict ${versionInfo.version}...`);
    const dlController = new AbortController();
    const dlTimeout = setTimeout(() => dlController.abort(), 120_000);
    try {
        const dlResponse = await fetch(`${server}${versionInfo.download_url}`, {
            headers: { 'User-Agent': USER_AGENT },
            signal: dlController.signal,
        });
        if (!dlResponse.ok) throw new Error(`Download returned ${dlResponse.status}`);
        mkdirSync(dirname(tempExe), { recursive: true });
        const fileStream = createWriteStream(tempExe);
        await finished(Readable.fromWeb(dlResponse.body).pipe(fileStream));
    } catch (error) {
        try { unlinkSync(tempExe); } catch { /* ignore */ }
        throw cliError(`Download failed: ${error.message}`, EXIT.NETWORK);
    } finally {
        clearTimeout(dlTimeout);
    }

    // Verify SHA-256 if available
    if (versionInfo.exe_sha256) {
        const { createHash } = await import('node:crypto');
        const downloadedBuffer = readFileSync(tempExe);
        const actualHash = createHash('sha256').update(downloadedBuffer).digest('hex').toLowerCase();
        if (actualHash !== versionInfo.exe_sha256.toLowerCase()) {
            try { unlinkSync(tempExe); } catch { /* ignore */ }
            throw cliError('SHA-256 mismatch. The downloaded file may be corrupted.', EXIT.FILE);
        }
        success('SHA-256 verified.');
    }

    // Replace the current executable
    // On Windows we cannot overwrite a running exe, so we rename current and move new
    const newExe = join(currentDir, `verdict.exe`);
    try {
        // Rename current exe as backup
        if (existsSync(backupExe)) unlinkSync(backupExe);
        renameSync(currentExe, backupExe);
        // Move temp exe to final location
        renameSync(tempExe, newExe);
    } catch (error) {
        // Rollback: restore backup if new exe not in place
        if (!existsSync(newExe) && existsSync(backupExe)) {
            try { renameSync(backupExe, currentExe); } catch { /* ignore */ }
        }
        throw cliError(`Could not replace verdict.exe: ${error.message}`, EXIT.FILE);
    }

    // Write SHA-256 manifest alongside
    if (versionInfo.exe_sha256) {
        try {
            writeFileSync(join(currentDir, 'verdict.exe.sha256'), `${versionInfo.exe_sha256}  verdict.exe\n`);
        } catch { /* non-fatal */ }
    }

    success(`Updated to verdict ${versionInfo.version}. Restart your terminal or run "verdict --version" to confirm.`);
}

async function waitForAudit(id) {
    const deadline = Date.now() + numberOption('timeout', 180) * 1000;
    let previous = '';
    while (Date.now() < deadline) {
        const progress = await api('GET', `/api/audit/${id}/progress`);
        const line = `${progress.percent ?? 0}% ${progress.stage || progress.status} ${progress.message || ''}`.trim();
        if (line !== previous && outputFormat !== 'quiet') console.error(`${paint('AUDIT', 'red')} #${id} ${line}`);
        previous = line;
        if (progress.status === 'COMPLETED') return output(await api('GET', `/api/audit/${id}`));
        if (progress.status === 'FAILED' || progress.status === 'CANCELLED') throw cliError(`Audit #${id} ${progress.status.toLowerCase()}: ${progress.message || ''}`, EXIT.JOB);
        await sleep(1200);
    }
    throw cliError(`Audit #${id} did not finish before timeout. Run "verdict audits watch ${id}".`, EXIT.TIMEOUT);
}

async function watch(filter = 'all') {
    let attempts = 0;
    console.error(`Watching ${filter}. Press Ctrl+C to stop.`);
    while (true) {
        try {
            const token = await validAccessToken();
            const response = await fetch(`${server}/api/realtime`, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream', 'User-Agent': USER_AGENT } });
            if (!response.ok) throw await responseError(response);
            attempts = 0;
            let buffer = '';
            for await (const chunk of Readable.fromWeb(response.body)) {
                buffer += chunk.toString('utf8');
                let split;
                while ((split = buffer.indexOf('\n\n')) >= 0) {
                    const packet = buffer.slice(0, split).replace(/\r/g, '');
                    buffer = buffer.slice(split + 2);
                    const event = parseSse(packet);
                    if (event && matchesEvent(event, filter)) eventOutput(event);
                }
            }
        } catch (error) {
            attempts += 1;
            const delay = Math.min(30, 2 ** Math.min(attempts, 5));
            console.error(`${paint('RECONNECTING', 'amber')} ${error.message}; retry in ${delay}s`);
            await sleep(delay * 1000);
        }
    }
}

async function api(method, path, body, extra = {}) {
    let token = await validAccessToken();
    try {
        return await rawRequest(method, path, body, { ...extra, token });
    } catch (error) {
        if (error.status !== 401) throw error;
        token = await refreshSession(true);
        return rawRequest(method, path, body, { ...extra, token });
    }
}

async function adminApi(method, path, body) {
    const credentials = await loadCredentials(`admin:${profileName}`);
    if (!credentials?.accessToken) throw cliError('Admin login required. Run "verdict admin login".', EXIT.AUTH);
    return rawRequest(method, path, body, { token: credentials.accessToken, admin: true });
}

async function rawRequest(method, path, body, requestOptions = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), numberOption('timeout', 30) * 1000);
    const requestId = String(options['request-id'] || crypto.randomUUID());
    const started = Date.now();
    const headers = { Accept: 'application/json', 'User-Agent': USER_AGENT, 'X-Request-Id': requestId };
    if (requestOptions.token) headers[requestOptions.admin ? 'X-Admin-Token' : 'Authorization'] = requestOptions.admin ? requestOptions.token : `Bearer ${requestOptions.token}`;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    try {
        const response = await fetch(`${server}${path}`, { method, headers, body: payload, signal: controller.signal });
        logEvent('request.completed', {
            requestId,
            method,
            path: String(path).split('?')[0],
            status: response.status,
            durationMillis: Date.now() - started,
        });
        if (!response.ok) throw await responseError(response);
        if (response.status === 204) return null;
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) return response.json();
        return response.text();
    } catch (error) {
        logEvent('request.failed', {
            requestId,
            method,
            path: String(path).split('?')[0],
            durationMillis: Date.now() - started,
            message: error.message || String(error),
        });
        if (error.name === 'AbortError') throw cliError(`Request timed out: ${method} ${path}`, EXIT.TIMEOUT);
        if (error.code !== undefined) throw error;
        throw cliError(`Cannot reach ${server}: ${error.message}`, EXIT.NETWORK);
    } finally {
        clearTimeout(timeout);
    }
}

async function responseError(response) {
    let message = `${response.status} ${response.statusText}`;
    try { const data = await response.json(); message = data.message || data.detail || message; } catch { /* HTTP fallback */ }
    const code = response.status === 401 ? EXIT.AUTH : response.status === 403 ? EXIT.FORBIDDEN : response.status === 404 ? EXIT.NOT_FOUND : response.status === 409 ? EXIT.CONFLICT : response.status === 422 || response.status === 400 ? EXIT.VALIDATION : response.status === 429 ? EXIT.RATE_LIMIT : EXIT.GENERAL;
    const error = cliError(message, code);
    error.status = response.status;
    return error;
}

async function validAccessToken() {
    if (process.env.VERDICT_TOKEN) return process.env.VERDICT_TOKEN;
    const credentials = await loadCredentials(profileName);
    if (!credentials?.accessToken) throw cliError('Login required. Run "verdict login".', EXIT.AUTH);
    if (credentials.accessExpiresAt && Date.parse(credentials.accessExpiresAt) < Date.now() + 15000) return refreshSession(true);
    return credentials.accessToken;
}

async function refreshSession(requiredRefresh = false) {
    const credentials = await loadCredentials(profileName);
    if (!credentials?.refreshToken) {
        if (requiredRefresh) throw cliError('Session expired. Run "verdict login".', EXIT.AUTH);
        return credentials?.accessToken;
    }
    const response = await rawRequest('POST', '/api/auth/refresh', { refresh_token: credentials.refreshToken }, { publicRequest: true });
    const next = { accessToken: response.access_token || response.token, refreshToken: response.refresh_token, accessExpiresAt: response.access_expires_at, refreshExpiresAt: response.refresh_expires_at };
    await storeCredentials(profileName, next);
    return next.accessToken;
}

async function download(path, filename) {
    const target = resolve(String(filename));
    if (existsSync(target) && !options.overwrite) throw cliError(`File exists: ${target}. Use --overwrite.`, EXIT.FILE);
    const token = await validAccessToken();
    const response = await fetch(`${server}${path}`, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT } });
    if (!response.ok) throw await responseError(response);
    mkdirSync(dirname(target), { recursive: true });
    await finished(Readable.fromWeb(response.body).pipe(createWriteStream(target)));
    success(`Saved ${target}`);
    if (outputFormat === 'quiet') console.log(target);
}

function output(data) {
    if (outputFormat === 'quiet') {
        if (data?.id !== undefined) console.log(data.id);
        return;
    }
    if (outputFormat === 'json') return console.log(JSON.stringify(data, null, 2));
    if (outputFormat === 'jsonl') return (Array.isArray(data) ? data : [data]).forEach((row) => console.log(JSON.stringify(row)));
    if (outputFormat === 'csv') return console.log(toCsv(Array.isArray(data) ? data : [data]));
    if (outputFormat === 'text') return console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    if (Array.isArray(data)) return table(data);
    if (data && typeof data === 'object') return table(Object.entries(flatten(data)).map(([field, value]) => ({ field, value })));
    console.log(data ?? 'OK');
}

function table(rows) {
    if (!rows.length) return console.log(paint('No results.', 'muted'));
    const flat = rows.map(flatten);
    const requested = splitList(options.fields);
    const columns = requested.length ? requested : Object.keys(flat[0]).slice(0, process.stdout.columns && process.stdout.columns < 100 ? 5 : 8);
    const widths = columns.map((column) => Math.min(42, Math.max(column.length, ...flat.map((row) => display(row[column]).length))));
    console.log(columns.map((column, index) => column.toUpperCase().padEnd(widths[index])).join('  '));
    console.log(widths.map((width) => '-'.repeat(width)).join('  '));
    flat.forEach((row) => console.log(columns.map((column, index) => truncate(display(row[column]), widths[index]).padEnd(widths[index])).join('  ')));
}

function flatten(value, prefix = '', result = {}) {
    if (value === null || value === undefined) { if (prefix) result[prefix] = ''; return result; }
    if (Array.isArray(value)) { result[prefix || 'value'] = value.map((item) => typeof item === 'object' ? JSON.stringify(item) : item).join(', '); return result; }
    if (typeof value !== 'object') { result[prefix || 'value'] = value; return result; }
    Object.entries(value).forEach(([key, child]) => {
        const name = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, name, result); else result[name] = Array.isArray(child) ? child.join(', ') : child;
    });
    return result;
}

function toCsv(rows) {
    if (!rows.length) return '';
    const flat = rows.map(flatten);
    const columns = splitList(options.fields).length ? splitList(options.fields) : Object.keys(flat[0]);
    return [columns, ...flat.map((row) => columns.map((column) => row[column]))].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function parseArguments(argv) {
    const result = { args: [], options: {} };
    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index];
        if (!value.startsWith('--')) { result.args.push(value); continue; }
        const [rawKey, inline] = value.slice(2).split(/=(.*)/s);
        const next = argv[index + 1];
        if (inline !== undefined) result.options[rawKey] = inline;
        else if (next !== undefined && !next.startsWith('--')) { result.options[rawKey] = next; index += 1; }
        else result.options[rawKey] = true;
    }
    return result;
}

function loadConfig() {
    const fallback = { activeProfile: 'local', profiles: { local: { server: 'http://localhost:8080', output: 'table', color: 'auto', editor: 'notepad' } } };
    try { return { ...fallback, ...JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) }; } catch { return fallback; }
}

function saveConfig(value) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_FILE, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    try { chmodSync(CONFIG_FILE, 0o600); } catch { /* Windows ACL owns access */ }
}

function persistSelectedServer() {
    if (!options.server) return;
    config.activeProfile = profileName;
    config.profiles[profileName] = { ...profile, server };
    saveConfig(config);
    logEvent('profile.server_saved', { profile: profileName, server });
}

async function storeCredentials(key, value) {
    const store = readCredentialStore();
    store[key] = await protect(JSON.stringify(value));
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CREDENTIAL_FILE, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

async function loadCredentials(key) {
    const encrypted = readCredentialStore()[key];
    if (!encrypted) return null;
    try { return JSON.parse(await unprotect(encrypted)); } catch { return null; }
}

async function removeCredentials(key) {
    const store = readCredentialStore();
    delete store[key];
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CREDENTIAL_FILE, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
}

function readCredentialStore() {
    try { return JSON.parse(readFileSync(CREDENTIAL_FILE, 'utf8')); } catch { return {}; }
}

async function protect(value) {
    if (platform() !== 'win32') return `user-file:${Buffer.from(value).toString('base64')}`;
    const script = "$v=[Console]::In.ReadToEnd();$s=ConvertTo-SecureString $v -AsPlainText -Force;ConvertFrom-SecureString $s";
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { input: value, encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw cliError('Windows credential encryption failed.', EXIT.FILE);
    return `dpapi:${result.stdout.trim()}`;
}

async function unprotect(value) {
    if (value.startsWith('user-file:')) return Buffer.from(value.slice(10), 'base64').toString('utf8');
    if (!value.startsWith('dpapi:')) throw new Error('Unknown credential format');
    const script = "$v=[Console]::In.ReadToEnd();$s=ConvertTo-SecureString $v;$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s);try{[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p)}";
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { input: value.slice(6), encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw cliError('Windows credential decryption failed.', EXIT.FILE);
    return result.stdout;
}

async function prompt(label) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(label);
    rl.close();
    return answer;
}

async function secretPrompt(label) {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) return prompt(label);
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    return new Promise((resolveSecret) => {
        let value = '';
        const onData = (key) => {
            if (key === '\r' || key === '\n') {
                process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', onData); process.stdout.write('\n'); resolveSecret(value); return;
            }
            if (key === '\u0003') process.exit(130);
            if (key === '\u007f' || key === '\b') { value = value.slice(0, -1); return; }
            value += key;
        };
        process.stdin.on('data', onData);
    });
}

async function confirm(message) {
    if (options.yes) return;
    const answer = await prompt(`${message} [y/N]: `);
    if (!/^y(es)?$/i.test(answer.trim())) throw cliError('Action cancelled.', EXIT.DECLINED);
}

async function typedConfirmation(message, phrase) {
    console.error(paint(`WARNING: ${message}`, 'red'));
    if (options['dry-run']) return;
    const answer = await prompt(`Type exactly "${phrase}": `);
    if (answer !== phrase) throw cliError('Confirmation did not match. Action cancelled.', EXIT.DECLINED);
}

function parseSse(packet) {
    let event = 'message';
    const data = [];
    packet.split('\n').forEach((line) => { if (line.startsWith('event:')) event = line.slice(6).trim(); if (line.startsWith('data:')) data.push(line.slice(5).trim()); });
    if (!data.length) return null;
    const text = data.join('\n');
    try { return { event, data: JSON.parse(text), receivedAt: new Date().toISOString() }; } catch { return { event, data: text, receivedAt: new Date().toISOString() }; }
}

function matchesEvent(event, filter) {
    if (!filter || filter === 'all') return true;
    if (filter.startsWith('project:')) return String(event.data?.projectId || event.data?.project_id) === filter.split(':')[1];
    return event.event.toLowerCase().includes(String(filter).replace(/s$/, '').toLowerCase());
}

function eventOutput(event) {
    if (outputFormat === 'jsonl' || outputFormat === 'json') return console.log(JSON.stringify(event));
    console.log(`${paint(new Date(event.receivedAt).toLocaleTimeString(), 'muted')} ${paint(event.event.toUpperCase(), 'red')} ${typeof event.data === 'string' ? event.data : JSON.stringify(event.data)}`);
}

function validateResume(path) {
    if (!existsSync(path)) throw cliError(`File not found: ${path}`, EXIT.FILE);
    if (!['.pdf', '.docx', '.txt'].includes(extname(path).toLowerCase())) throw cliError('Resume must be PDF, DOCX, or TXT.', EXIT.VALIDATION);
    if (readFileSync(path).byteLength > 8 * 1024 * 1024) throw cliError('Resume must be 8 MB or smaller.', EXIT.VALIDATION);
}

function validateTemplate(payload) {
    const errors = [];
    if (!payload || typeof payload !== 'object') return [{ status: 'FAIL', detail: 'Template must be a JSON object.' }];
    if (!payload.name && !payload.template?.name) errors.push({ status: 'FAIL', detail: 'Template name is required.' });
    const rules = payload.rules || payload.template?.rules || [];
    if (!Array.isArray(rules)) errors.push({ status: 'FAIL', detail: 'rules must be an array.' });
    const seen = new Set();
    if (Array.isArray(rules)) rules.forEach((rule, index) => { const keyword = String(rule.keyword || rule.phrase || '').trim().toLowerCase(); if (!keyword) errors.push({ status: 'FAIL', detail: `Rule ${index + 1} has no keyword.` }); else if (seen.has(keyword)) errors.push({ status: 'FAIL', detail: `Duplicate keyword: ${keyword}` }); else seen.add(keyword); });
    return errors;
}

function filterMessages(rows, folder) {
    if (!folder) return rows;
    const name = String(folder).toLowerCase();
    if (name === 'starred') return rows.filter((row) => row.starred);
    if (name === 'archived') return rows.filter((row) => row.archived);
    if (name === 'inbox') return rows.filter((row) => !row.archived);
    return rows;
}

function parseAttachments(value) {
    if (!value) return [];
    return String(value).split(',').map((item) => { const [projectId, candidateId] = item.split(':').map(Number); return { project_id: projectId, candidate_id: candidateId }; }).filter((row) => row.project_id && row.candidate_id);
}

function writeExport(filename, content) {
    const path = resolve(String(filename));
    if (existsSync(path) && !options.overwrite) throw cliError(`File exists: ${path}. Use --overwrite.`, EXIT.FILE);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${content}\n`, 'utf8');
    success(`Saved ${path}`);
}

function readTextFile(path) {
    const file = resolve(String(path));
    if (!existsSync(file)) throw cliError(`File not found: ${file}`, EXIT.FILE);
    return readFileSync(file, 'utf8');
}

function preview(title, value) {
    if (outputFormat !== 'quiet') { console.error(paint(title, 'red')); Object.entries(value).forEach(([key, item]) => console.error(`  ${key.padEnd(14)} ${display(item)}`)); }
}

function required(value, message) { if (value === undefined || value === null || value === '') throw cliError(message, EXIT.ARGUMENT); return String(value); }
function numberOption(name, fallback) { const value = Number(options[name] ?? fallback); return Number.isFinite(value) ? value : fallback; }
function zeroPage() { return Math.max(0, numberOption('page', 1) - 1); }
function queryString(values) { return new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])).toString(); }
function splitList(value) { return value ? String(value).split(',').map((item) => item.trim()).filter(Boolean) : []; }
function splitCommandLine(value) {
    const parts = [];
    let current = '';
    let quote = '';
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];
        if (quote && character === quote) { quote = ''; continue; }
        if (!quote && (character === '"' || character === "'")) { quote = character; continue; }
        if (!quote && /\s/.test(character)) { if (current) { parts.push(current); current = ''; } continue; }
        if (character === '\\' && quote && value[index + 1] === quote) { current += quote; index += 1; continue; }
        current += character;
    }
    if (quote) throw cliError('Unclosed quote in command.', EXIT.ARGUMENT);
    if (current) parts.push(current);
    return parts;
}
function trimSlash(value) { return value.replace(/\/+$/, ''); }
function truncate(value, length) { const text = String(value ?? ''); return text.length <= length ? text : `${text.slice(0, Math.max(0, length - 3))}...`; }
function display(value) { if (value === null || value === undefined) return ''; if (typeof value === 'object') return JSON.stringify(value); return String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x1B]/g, ''); }
function csvCell(value) { const text = display(value); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function prefixSubject(prefix, subject = '') { return subject.toLowerCase().startsWith(prefix.toLowerCase()) ? subject : `${prefix} ${subject}`; }
function sleep(ms) { return new Promise((resolveSleep) => setTimeout(resolveSleep, ms)); }
function success(message) { if (outputFormat !== 'quiet') console.log(`${paint('OK', 'green')} ${message}`); }
function cliError(message, code = EXIT.GENERAL) { const error = new Error(message); error.code = code; return error; }
function paint(value, tone) { if (!colorEnabled) return value; const colors = { red: 31, green: 32, amber: 33, muted: 90 }; return `\u001b[${colors[tone] || 0}m${value}\u001b[0m`; }
function fail(error) {
    console.error(`${paint('ERROR', 'red')} ${error.message || error}`);
    console.error(`${paint('LOG', 'muted')} ${LOG_FILE}`);
    if (options.debug && error.stack) console.error(redact(error.stack));
    process.exitCode = Number.isInteger(error.code) ? error.code : EXIT.GENERAL;
}

function logEvent(event, detail = {}) {
    try {
        mkdirSync(LOG_DIR, { recursive: true });
        const payload = {
            timestamp: new Date().toISOString(),
            event,
            detail: JSON.parse(redact(JSON.stringify(detail))),
        };
        appendFileSync(LOG_FILE, `${JSON.stringify(payload)}\n`, { encoding: 'utf8', mode: 0o600 });
    } catch {
        // Diagnostics must never make a user command fail.
    }
}

function redact(value) {
    return String(value)
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
        .replace(/("(?:accessToken|refreshToken|password|token|code)"\s*:\s*")[^"]+"/gi, '$1[REDACTED]"')
        .replace(/\b[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}\b/g, '[PAIRING-CODE-REDACTED]');
}

function sanitizeArguments(values) {
    const sensitive = new Set(['--password', '--token', '--access-token', '--refresh-token', '--code']);
    return values.map((value, index) => {
        const previous = String(values[index - 1] || '').toLowerCase();
        if (sensitive.has(previous)) return '[REDACTED]';
        if (/^--(?:password|token|access-token|refresh-token|code)=/i.test(value)) {
            return `${String(value).split('=')[0]}=[REDACTED]`;
        }
        return redact(value);
    });
}
