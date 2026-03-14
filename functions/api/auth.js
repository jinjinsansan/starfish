export async function onRequestPost(context) {
  const { password } = await context.request.json();

  if (password !== context.env.AUTH_PASSWORD) {
    return new Response('Unauthorized', { status: 401 });
  }

  const token = await generateToken(context.env.AUTH_SECRET);

  return new Response('OK', {
    headers: {
      'Set-Cookie': `token=${token}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=2592000`,
    },
  });
}

// Logout
export async function onRequestDelete() {
  return new Response('OK', {
    headers: {
      'Set-Cookie': 'token=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0',
    },
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
