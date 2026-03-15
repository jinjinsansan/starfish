const VIDEO_EXTENSIONS = new Set([
  'mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'ogv',
]);

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const prefix = url.searchParams.get('prefix') || '';

  const list = await context.env.BUCKET.list({
    prefix,
    delimiter: '/',
    limit: 1000,
  });

  // Extract folders from delimited prefixes
  const folders = (list.delimitedPrefixes || []).map((p) => ({
    name: p.replace(prefix, '').replace(/\/$/, ''),
    prefix: p,
    type: 'folder',
  }));

  // Filter video files (exclude _thumbs/)
  const videos = list.objects
    .filter((obj) => {
      if (obj.key.startsWith('_thumbs/')) return false;
      const ext = obj.key.split('.').pop().toLowerCase();
      return VIDEO_EXTENSIONS.has(ext);
    })
    .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
    .map((obj) => ({
      key: obj.key,
      name: obj.key.replace(prefix, ''),
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
      type: 'video',
    }));

  return Response.json({ folders, videos });
}

export async function onRequestDelete(context) {
  const { key } = await context.request.json();

  if (!key || typeof key !== 'string') {
    return new Response('Missing key', { status: 400 });
  }

  // Delete the video
  await context.env.BUCKET.delete(key);

  // Also delete thumbnail if exists
  await context.env.BUCKET.delete(`_thumbs/${key}.jpg`);

  return Response.json({ success: true });
}
