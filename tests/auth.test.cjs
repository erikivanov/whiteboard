const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const load = (file, deps = {}) => {
  const filename = path.resolve(file), m = new Module(filename, module);
  m.paths = module.paths; const req = m.require.bind(m);
  m.require = id => deps[id] ?? req(id);
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
  return m.exports;
};
const policy = load('lib/auth-policy.ts');
const auth = load('lib/auth.ts', { './auth-policy': policy, 'next/headers': { cookies: async () => new Map() } });
const key = Buffer.from('test-signing-key-with-at-least-32-bytes-123456789');
process.env.AUTH_SECRET = key.toString();
process.env.APP_URL = 'http://localhost:3001';
process.env.GITHUB_CLIENT_ID = 'test-client';
process.env.GITHUB_CLIENT_SECRET = 'test-secret';
const user = { id: policy.ALLOWED_GITHUB_ID, login: policy.ALLOWED_GITHUB_LOGIN, name: 'Erik', avatarUrl: '' };
const session = () => ({ ...user, kind: 'session', expiresAt: Date.now() + 60000 });

test('Allein das feste GitHub-Konto erikivanov wird akzeptiert', () => {
  assert.equal(policy.isAllowedGithubUser({ id: 60944586, login: 'erikivanov', type: 'User' }), true);
  assert.equal(policy.isAllowedGithubUser({ id: 60944586, login: 'ErikIvanov' }), true);
  for (const value of [null, {}, { id: 1, login: 'erikivanov' }, { id: 60944586, login: 'someone-else' }, { id: '60944586', login: 'erikivanov' }, { id: 60944586, login: 'erikivanov', type: 'Bot' }]) assert.equal(policy.isAllowedGithubUser(value), false);
});
test('Signierte Sitzungen verhindern Manipulation, falsche Schlüssel und abgelaufene Cookies', () => {
  const token = auth.signPayload(session(), key);
  assert.equal(auth.verifyPayload(token, key, 'session').login, 'erikivanov');
  assert.equal(auth.verifyPayload(token + 'x', key, 'session'), null);
  assert.equal(auth.verifyPayload(token, Buffer.from('wrong-key'), 'session'), null);
  assert.equal(auth.verifyPayload(auth.signPayload({ ...session(), expiresAt: Date.now() - 1 }, key), key, 'session'), null);
  assert.equal(auth.verifyPayload(token, key, 'oauth'), null);
  assert.equal(auth.verifyPayload('not.a.valid.cookie', key, 'session'), null);
});
test('API-Sitzungsprüfung verwirft auch korrekt signierte fremde Konten', async () => {
  const request = value => ({ cookies: { get: () => value ? { value } : undefined } });
  assert.equal((await auth.getOwner(request(auth.signPayload(session(), key)))).id, 60944586);
  assert.equal(await auth.getOwner(request(auth.signPayload({ ...session(), id: 1 }, key))), null);
  assert.equal(await auth.getOwner(request(undefined)), null);
});
test('Sitzungscookies sind HttpOnly, SameSite=Lax und auf HTTPS zusätzlich Secure', () => {
  assert.deepEqual(auth.authCookieOptions(60), { httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: 60 });
  process.env.APP_URL = 'https://example.com'; assert.equal(auth.authCookieOptions(60).secure, true); process.env.APP_URL = 'http://localhost:3001';
});

const response = location => ({ location: String(location), headers: new Map(), cookies: { values: new Map(), set(name, value, options) { this.values.set(name, { value, options }); } } });
const callback = load('app/api/auth/github/callback/route.ts', {
  'next/server': { NextResponse: { redirect: location => response(location) } },
  '@/lib/auth': auth, '@/lib/auth-policy': policy,
});
const flow = () => ({ kind: 'oauth', state: 'random-state', verifier: 'random-verifier-with-more-than-forty-three-characters', redirectUri: 'http://localhost:3001/api/auth/github/callback', expiresAt: Date.now() + 60000 });
const request = (query, transaction = flow()) => ({ nextUrl: new URL('http://localhost:3001/api/auth/github/callback?' + query), cookies: { get: () => ({ value: auth.signPayload(transaction, key) }) } });

test('OAuth-Callback prüft State und Ablauf, bevor er GitHub kontaktiert', async () => {
  const original = global.fetch; let calls = 0; global.fetch = async () => { calls++; throw Error('must not fetch'); };
  try {
    for (const req of [request('code=x&state=wrong'), request('code=x'), request('code=x&state=random-state', { ...flow(), expiresAt: Date.now() - 10 })]) {
      const r = await callback.GET(req); assert.equal(new URL(r.location).searchParams.get('login'), 'invalid_state'); assert.equal(r.cookies.values.has(auth.SESSION_COOKIE), false);
    }
    assert.equal(calls, 0);
  } finally { global.fetch = original; }
});
test('Erlaubtes Konto erhält nach geprüftem GitHub-Callback eine Sitzung und landet auf dem Dashboard', async () => {
  const original = global.fetch, calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => calls.length === 1 ? { access_token: 'test-access-token' } : { id: 60944586, login: 'erikivanov', name: 'Erik', type: 'User' } };
  };
  try {
    const r = await callback.GET(request('code=one-time-code&state=random-state'));
    assert.equal(new URL(r.location).pathname, '/dashboard');
    const cookie = r.cookies.values.get(auth.SESSION_COOKIE); assert.equal(auth.verifyPayload(cookie.value, key, 'session').id, 60944586); assert.equal(cookie.options.httpOnly, true);
    assert.equal(r.cookies.values.get(auth.OAUTH_COOKIE).options.maxAge, 0);
    assert.equal(calls[0].options.body.get('code_verifier'), flow().verifier);
    assert.equal(calls[1].url, 'https://api.github.com/user');
    assert.equal(calls[1].options.headers.Authorization, 'Bearer test-access-token');
  } finally { global.fetch = original; }
});
test('Ein anderes GitHub-Konto erhält auch nach erfolgreichem OAuth-Austausch keine Sitzung', async () => {
  const original = global.fetch; let calls = 0;
  global.fetch = async () => ({ ok: true, json: async () => ++calls === 1 ? { access_token: 'test' } : { id: 123, login: 'another-user', type: 'User' } });
  try {
    const r = await callback.GET(request('code=x&state=random-state'));
    assert.equal(new URL(r.location).searchParams.get('login'), 'not_allowed'); assert.equal(r.cookies.values.has(auth.SESSION_COOKIE), false);
  } finally { global.fetch = original; }
});
test('Abgebrochene oder fehlgeschlagene GitHub-Anmeldung erzeugt keine Sitzung', async () => {
  const original = global.fetch; global.fetch = async () => ({ ok: false, json: async () => ({ error: 'bad_verification_code' }) });
  try {
    const cancelled = await callback.GET(request('error=access_denied&state=random-state'));
    assert.equal(new URL(cancelled.location).searchParams.get('login'), 'cancelled');
    const failed = await callback.GET(request('code=invalid&state=random-state'));
    assert.equal(new URL(failed.location).searchParams.get('login'), 'failed'); assert.equal(failed.cookies.values.has(auth.SESSION_COOKIE), false);
  } finally { global.fetch = original; }
});

test('Logout sperrt auch eine kopierte Sitzung dauerhaft, andere Sitzungen bleiben gültig', async () => {
  const first = await auth.ownerSessionCookie(user), second = await auth.ownerSessionCookie(user);
  const request = value => ({ cookies: { get: () => ({ value }) } });
  assert.notEqual(first, second);
  assert.equal((await auth.getOwner(request(first))).id, user.id);
  await auth.revokeSession(first);
  assert.equal(await auth.getOwner(request(first)), null);
  assert.equal((await auth.getOwner(request(second))).id, user.id);
  const freshAuth = load('lib/auth.ts', { './auth-policy': policy, 'next/headers': { cookies: async () => new Map() } });
  assert.equal(await freshAuth.getOwner(request(first)), null);
  const hash = require('node:crypto').createHash('sha256').update(first).digest('hex');
  const expiry = auth.verifyPayload(first, key, 'session').expiresAt;
  fs.unlinkSync(path.join('.data/auth/revoked', `${expiry}-${hash}`));
});
