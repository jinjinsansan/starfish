export async function onRequestGet(context) {
  const key = context.params.key.join('/');
  const thumbKey = `_thumbs/${key}.jpg`;

  const object = await context.env.BUCKET.get(thumbKey);
  if (!object) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

export async function onRequestPut(context) {
  const key = context.params.key.join('/');
  const thumbKey = `_thumbs/${key}.jpg`;

  await context.env.BUCKET.put(thumbKey, context.request.body, {
    httpMetadata: { contentType: 'image/jpeg' },
  });

  return Response.json({ success: true });
}
