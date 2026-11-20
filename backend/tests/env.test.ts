import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const backendDirectory = fileURLToPath(new URL('../', import.meta.url));

// Load the real startup configuration in an isolated process for each case.
// Importing env.ts does not connect to a database or start the server.
function loadConfig(databaseUrl: string) {
  return spawnSync(process.execPath, [
    '--import', 'tsx',
    '--input-type=module',
    '--eval',
    "import { env } from './src/config/env.ts'; console.log(JSON.stringify(env.databaseUrl));",
  ], {
    cwd: backendDirectory,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf8',
    timeout: 10_000,
  });
}

const validUrls = [
  {
    name: 'Render internal URL without a dotted hostname or explicit port',
    input: 'postgresql://user:password@dpg-example-a/nazarai',
  },
  {
    name: 'Render internal URL with the postgres scheme and explicit port',
    input: 'postgres://user:password@dpg-example-a:5432/nazarai',
  },
  {
    name: 'Docker service hostname',
    input: 'postgresql://user:password@postgres:5432/nazarai',
  },
  {
    name: 'Render external URL preserving encoded credentials and TLS options',
    input: 'postgresql://user:p%40ss%3Aword@dpg-example-a.oregon-postgres.render.com/nazarai?sslmode=require&application_name=nazarai',
  },
  {
    name: 'localhost URL',
    input: 'postgresql://postgres:password@localhost:5432/nazarai',
  },
  {
    name: 'IPv4 URL',
    input: 'postgresql://postgres:password@127.0.0.1:5432/nazarai',
  },
  {
    name: 'IPv6 URL',
    input: 'postgresql://postgres:password@[::1]:5432/nazarai',
  },
  {
    name: 'surrounding whitespace',
    input: '  postgresql://user:password@dpg-example-a/nazarai\n',
    expected: 'postgresql://user:password@dpg-example-a/nazarai',
  },
  {
    name: 'legacy Python driver scheme',
    input: 'postgresql+psycopg2://user:password@dpg-example-a/nazarai',
    expected: 'postgresql://user:password@dpg-example-a/nazarai',
  },
  {
    name: 'existing default database behavior with no path',
    input: 'postgresql://postgres:password@localhost:5432',
    expected: 'postgresql://postgres:password@localhost:5432/nazarai',
  },
  {
    name: 'existing default database behavior with an empty path and query',
    input: 'postgresql://user:password@dpg-example-a/?application_name=nazarai',
    expected: 'postgresql://user:password@dpg-example-a/nazarai?application_name=nazarai',
  },
];

for (const { name, input, expected = input } of validUrls) {
  test(`accepts ${name}`, () => {
    const result = loadConfig(input);
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    const lastLine = result.stdout.trim().split('\n').at(-1)!;
    assert.equal(JSON.parse(lastLine), expected);
  });
}

const invalidUrls = [
  { name: 'empty value', input: '', message: 'DATABASE_URL is required' },
  { name: 'whitespace-only value', input: ' \n\t ', message: 'DATABASE_URL is required' },
  { name: 'bare Render hostname', input: 'dpg-example-a' },
  { name: 'HTTP URL', input: 'https://example.com/nazarai' },
  { name: 'non-PostgreSQL database URL', input: 'mysql://user:password@host/nazarai' },
  { name: 'URL without a hostname', input: 'postgresql:///nazarai' },
  { name: 'invalid port', input: 'postgresql://user:password@host:bad/nazarai' },
];

for (const { name, input, message = 'DATABASE_URL is invalid' } of invalidUrls) {
  test(`rejects ${name}`, () => {
    const result = loadConfig(input);
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(message), result.stderr);
  });
}

test('does not disclose credentials when reporting an invalid URL', () => {
  const password = 'test-only-sensitive-password';
  const result = loadConfig(`https://user:${password}@example.com/nazarai`);
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('DATABASE_URL is invalid'));
  assert.ok(!`${result.stdout}${result.stderr}`.includes(password));
});
