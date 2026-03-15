import { generateToken, sha256, generateCsrfToken } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { password } = req.body || {};

    const inputHash = sha256(password || '');
    const expectedHash = sha256(process.env.AUTH_PASSWORD);

    if (inputHash !== expectedHash) {
      await new Promise((r) => setTimeout(r, 2000));
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = generateToken(process.env.AUTH_SECRET);
    const csrf = generateCsrfToken();
    const cookieOpts = 'Path=/; Secure; SameSite=Strict; Max-Age=2592000';

    res.setHeader('Set-Cookie', [
      `token=${token}; ${cookieOpts}; HttpOnly`,
      `csrf=${csrf}; ${cookieOpts}`,
    ]);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', [
      'token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
      'csrf=; Path=/; Secure; SameSite=Strict; Max-Age=0',
    ]);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
