import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const cli = resolve('tools/verdict-cli/verdict.mjs');

test('help exposes the runnable connector command groups', async () => {
    const { stdout } = await execute(process.execPath, [cli, 'help'], { env: isolatedEnvironment() });
    assert.match(stdout, /VERDICT CLI 1\.1\.0/);
    assert.match(stdout, /dashboard, shell, reports, notifications, batch/);
    assert.match(stdout, /projects\s+list, show, create/);
});

test('unknown commands use the stable argument exit code', async () => {
    await assert.rejects(
        execute(process.execPath, [cli, 'definitely-not-a-command'], { env: isolatedEnvironment() }),
        (error) => error.code === 2 && /Unknown command/.test(error.stderr),
    );
});

test('health connects to the selected server and emits machine-readable JSON', async (context) => {
    const server = createServer((request, response) => {
        assert.equal(request.url, '/api/system/health');
        assert.match(request.headers['user-agent'], /^VERDICT-CLI\/1\.1\.0/);
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ status: 'UP', database: { status: 'UP' } }));
    });
    await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
    context.after(() => server.close());
    const address = server.address();
    const { stdout } = await execute(process.execPath, [cli, 'health', '--server', `http://127.0.0.1:${address.port}`, '--output', 'json'], { env: isolatedEnvironment() });
    const result = JSON.parse(stdout);
    assert.equal(result.status, 'UP');
    assert.equal(result.database.status, 'UP');
    assert.equal(typeof result.responseMillis, 'number');
});

test('one-time pairing connects without sending a password', async (context) => {
    let received;
    const server = createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        received = { url: request.url, method: request.method, body: JSON.parse(body) };
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({
            access_token: 'paired-access-token',
            refresh_token: 'paired-refresh-token',
            access_expires_at: new Date(Date.now() + 900000).toISOString(),
            refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
            user: { username: 'paired-user', fullName: 'Paired User' },
        }));
    });
    await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
    context.after(() => server.close());
    const address = server.address();
    const environment = isolatedEnvironment();
    const selectedServer = `http://127.0.0.1:${address.port}`;
    const { stdout } = await execute(process.execPath, [
        cli, 'connect', 'ABCD-EFGH', '--name', 'QA terminal',
        '--server', selectedServer, '--no-color',
    ], { env: environment });
    assert.match(stdout, /Connected QA terminal as Paired User/);
    assert.deepEqual(received, {
        url: '/api/auth/cli/pair',
        method: 'POST',
        body: { code: 'ABCD-EFGH', clientName: 'QA terminal' },
    });
    assert.equal(Object.hasOwn(received.body, 'password'), false);
    const savedConfig = JSON.parse(readFileSync(join(environment.APPDATA, 'VERDICT', 'cli-config.json'), 'utf8'));
    assert.equal(savedConfig.activeProfile, 'local');
    assert.equal(savedConfig.profiles.local.server, selectedServer);
});

function isolatedEnvironment() {
    const directory = mkdtempSync(join(tmpdir(), 'verdict-cli-test-'));
    process.on('exit', () => rmSync(directory, { recursive: true, force: true }));
    return { ...process.env, APPDATA: directory, LOCALAPPDATA: directory, NO_COLOR: '1' };
}
