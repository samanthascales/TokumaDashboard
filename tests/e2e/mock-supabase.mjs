// Minimal stand-in for Supabase Auth (GoTrue) + PostgREST, for end-to-end tests only.
// Mirrors the security rules in supabase/migrations/001_workspaces.sql.
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = +(process.env.PORT || 54321);
const users = new Map(); // id -> {id,email,password}
const tokens = new Map(); // access token -> user id
const refresh = new Map(); // refresh token -> user id
const admins = new Set();
const workspaces = []; // {id, owner_id, data, business_name, allow_support, created_at, updated_at}
const log = []; // {id, workspace_id, admin_id, reason, accessed_at}
let logId = 0;
let clock = Date.now();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function ts() {
  clock = Math.max(clock + 1, Date.now());
  const d = new Date(clock);
  return d.toISOString().replace('Z', '') + String(Math.floor(Math.random() * 1000)).padStart(3, '0') + '+00:00';
}
function session(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp })}.sig${crypto.randomUUID()}`;
  const rt = crypto.randomUUID();
  tokens.set(access, u.id);
  refresh.set(rt, u.id);
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: rt, user: pub(u) };
}
const pub = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() });

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': '*', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
const authErr = (res, code, msg) => send(res, 400, { code: 400, error_code: code, msg });
const rlsErr = (res) => send(res, 403, { code: '42501', message: 'new row violates row-level security policy', details: null, hint: null });

function filters(url) {
  const f = [];
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'columns'].includes(k)) continue;
    const m = v.match(/^eq\.(.*)$/);
    if (m) f.push([k, m[1]]);
  }
  return f;
}
const match = (row, f) => f.every(([k, v]) => String(row[k]) === v);

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });
    return res.end();
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  let raw = '';
  for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : {};
  const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
  const uid = tokens.get(bearer) || null;
  const p = url.pathname;

  // ---- test controls
  if (p === '/__test/make-admin') {
    const u = [...users.values()].find((x) => x.email === body.email);
    if (u) admins.add(u.id);
    return send(res, 200, { ok: !!u });
  }
  if (p === '/__test/state') return send(res, 200, { workspaces, log, admins: [...admins] });

  // ---- auth
  if (p === '/auth/v1/signup' && req.method === 'POST') {
    if ([...users.values()].some((u) => u.email === body.email)) return authErr(res, 'user_already_exists', 'User already registered');
    if (!body.password || body.password.length < 6) return authErr(res, 'weak_password', 'Password should be at least 6 characters.');
    const u = { id: crypto.randomUUID(), email: body.email, password: body.password };
    users.set(u.id, u);
    return send(res, 200, session(u));
  }
  if (p === '/auth/v1/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const u = [...users.values()].find((x) => x.email === body.email && x.password === body.password);
      if (!u) return authErr(res, 'invalid_credentials', 'Invalid login credentials');
      return send(res, 200, session(u));
    }
    if (grant === 'refresh_token') {
      const id = refresh.get(body.refresh_token);
      if (!id) return authErr(res, 'refresh_token_not_found', 'Invalid Refresh Token');
      return send(res, 200, session(users.get(id)));
    }
  }
  if (p === '/auth/v1/user' && req.method === 'GET') {
    if (!uid) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    return send(res, 200, pub(users.get(uid)));
  }
  if (p === '/auth/v1/logout') {
    tokens.delete(bearer);
    return send(res, 204);
  }
  if (p === '/auth/v1/recover') return send(res, 200, {});

  // ---- rest (all require a signed-in user, like the SQL grants)
  if (p.startsWith('/rest/v1/') && !uid) return send(res, 401, { code: '42501', message: 'permission denied' });
  const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object');
  const out = (rows) => {
    if (wantsObject) return rows.length === 1 ? send(res, 200, rows[0]) : send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
    return send(res, 200, rows);
  };

  if (p === '/rest/v1/workspaces') {
    const own = workspaces.filter((w) => w.owner_id === uid); // RLS
    const f = filters(url);
    if (req.method === 'GET') return out(own.filter((w) => match(w, f)));
    if (req.method === 'POST') {
      if (body.owner_id !== uid) return rlsErr(res);
      if (workspaces.some((w) => w.owner_id === uid)) return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint' });
      const now = ts();
      const w = { id: crypto.randomUUID(), owner_id: uid, data: {}, business_name: '', allow_support: false, created_at: now, updated_at: now };
      workspaces.push(w);
      return out([w]);
    }
    if (req.method === 'PATCH') {
      if ('owner_id' in body && body.owner_id !== uid) return rlsErr(res);
      const rows = own.filter((w) => match(w, f));
      for (const w of rows) Object.assign(w, body, { updated_at: ts() });
      const sel = url.searchParams.get('select');
      const pick = (w) => (sel && sel !== '*' ? Object.fromEntries(sel.split(',').map((k) => [k.trim(), w[k.trim()]])) : w);
      return out(rows.map(pick));
    }
  }
  if (p === '/rest/v1/support_access_log' && req.method === 'GET') {
    const mine = new Set(workspaces.filter((w) => w.owner_id === uid).map((w) => w.id));
    const rows = log.filter((l) => mine.has(l.workspace_id) && match(l, filters(url))).sort((a, b) => b.accessed_at.localeCompare(a.accessed_at));
    return out(rows.map(({ id, reason, accessed_at }) => ({ id, reason, accessed_at })));
  }
  if (p === '/rest/v1/rpc/is_admin') return send(res, 200, admins.has(uid));
  if (p === '/rest/v1/rpc/admin_list_workspaces') {
    if (!admins.has(uid)) return send(res, 403, { code: '42501', message: 'not authorized' });
    return send(
      res,
      200,
      workspaces.map((w) => ({ id: w.id, business_name: w.business_name, owner_email: users.get(w.owner_id).email, allow_support: w.allow_support, products: (w.data.products || []).length, transactions: (w.data.transactions || []).length, created_at: w.created_at, updated_at: w.updated_at })),
    );
  }
  if (p === '/rest/v1/rpc/admin_open_workspace') {
    if (!admins.has(uid)) return send(res, 403, { code: '42501', message: 'not authorized' });
    if (!body.reason || body.reason.trim().length < 5) return send(res, 400, { code: '22023', message: 'a reason of at least 5 characters is required' });
    const w = workspaces.find((x) => x.id === body.target);
    if (!w) return send(res, 404, { code: 'P0002', message: 'workspace not found' });
    if (!w.allow_support) return send(res, 403, { code: '42501', message: 'this business has not allowed support access' });
    log.push({ id: ++logId, workspace_id: w.id, admin_id: uid, reason: body.reason.trim(), accessed_at: ts() });
    return send(res, 200, w.data);
  }
  send(res, 404, { message: `mock: no route for ${req.method} ${p}` });
});
server.listen(PORT, '127.0.0.1', () => console.log('mock supabase on', PORT));
