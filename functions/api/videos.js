const VIDEO_EXTENSIONS = new Set([
  'mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'ogv',
]);

export async function onRequestGet(context) {
  const list = await context.env.BUCKET.list({ limit: 1000 });

  const videos = list.objects
    .filter((obj) => {
      const ext = obj.key.split('.').pop().toLowerCase();
      return VIDEO_EXTENSIONS.has(ext);
    })
    .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())
    .map((obj) => ({
      key: obj.key,
      name: obj.key,
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
    }));

  return new Response(JSON.stringify(videos), {
    headers: { 'Content-Type': 'application/json' },
  });
}
