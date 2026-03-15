export async function onRequestPost(context) {
  const { password } = await context.request.json();

  // Constant-time-ish comparison via hashing both sides
  const inputHash = await sha256(password || '');
  const expectedHash = await sha256(context.env.AUTH_PASSWORD);

  if (inputHash !== expectedHash) {
    // Rate limiting: add delay on failed attempts to slow brute force
    await new Promise((r) => setTimeout(r, 2000));
    return new Response('Unauthorized', { status: 401 });
  }

  const token = await generateToken(context.env.AUTH_SECRET);
  const csrf = generateCsrfToken();
  const cookieOpts = 'Path=/; Secure; SameSite=Strict; Max-Age=2592000';

  return new Response('OK', {
    headers: [
      ['Set-Cookie', `token=${token}; ${cookieOpts}; HttpOnly`],
      ['Set-Cookie', `csrf=${csrf}; ${cookieOpts}`],
    ],
  });
}

// Logout
export async function onRequestDelete() {
  return new Response('OK', {
    headers: [
      ['Set-Cookie', 'token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'],
      ['Set-Cookie', 'csrf=; Path=/; Secure; SameSite=Strict; Max-Age=0'],
    ],
  });
}

async function generateToken(secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode('starfish-auth:' + secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateCsrfToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
