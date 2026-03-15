import crypto from 'crypto';

export function generateToken(secret) {
  return crypto.createHash('sha256').update('starfish-auth:' + secret).digest('hex');
}

export function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function verifyAuth(req) {
  const cookie = req.headers.cookie || '';
  const token = cookie.match(/(?:^|;\s*)token=([^;]*)/)?.[1];
  if (!token) return false;
  const expected = generateToken(process.env.AUTH_SECRET);
  return token === expected;
}

export function verifyCsrf(req) {
  const cookie = req.headers.cookie || '';
  const csrfCookie = cookie.match(/(?:^|;\s*)csrf=([^;]*)/)?.[1];
  const csrfHeader = req.headers['x-csrf-token'];
  return !!(csrfCookie && csrfHeader && csrfCookie === csrfHeader);
}

export function requireAuth(req, res) {
  if (!verifyAuth(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export function requireCsrf(req, res) {
  if (!verifyCsrf(req)) {
    res.status(403).json({ error: 'CSRF validation failed' });
    return false;
  }
  return true;
}
