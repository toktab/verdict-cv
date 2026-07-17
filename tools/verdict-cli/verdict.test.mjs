import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const cli = resolve('tools/verdict-cli/verdict.mjs');

test('help exposes the runnable connector command groups', async () => {
    const { stdout } = await execute(process.execPath, [cli, 'help'], { env: isolatedEnvironment() });
    assert.match(stdout, /VERDICT CLI 1\.0\.0/);
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
        assert.match(request.headers['user-agent'], /^VERDICT-CLI\/1\.0\.0/);
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

function isolatedEnvironment() {
    const directory = mkdtempSync(join(tmpdir(), 'verdict-cli-test-'));
    process.on('exit', () => rmSync(directory, { recursive: true, force: true }));
    return { ...process.env, APPDATA: directory, NO_COLOR: '1' };
}
