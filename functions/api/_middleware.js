export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Auth endpoint is public
  if (url.pathname === '/api/auth') {
    return context.next();
  }

  // Verify auth cookie
  const cookie = context.request.headers.get('Cookie') || '';
  const token = cookie.match(/(?:^|;\s*)token=([^;]*)/)?.[1];

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const expected = await generateToken(context.env.AUTH_SECRET);
  if (token !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }

  return context.next();
}

async function generateToken(secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode('starfish-auth:' + secret);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
