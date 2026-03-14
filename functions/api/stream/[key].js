const CONTENT_TYPES = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  m4v: 'video/x-m4v',
  ogv: 'video/ogg',
};

export async function onRequestGet(context) {
  const key = decodeURIComponent(context.params.key);
  const rangeHeader = context.request.headers.get('Range');

  // Get object metadata first for range calculations
  const head = await context.env.BUCKET.head(key);
  if (!head) {
    return new Response('Not found', { status: 404 });
  }

  const totalSize = head.size;
  const ext = key.split('.').pop().toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

  // No range requested - return full file
  if (!rangeHeader) {
    const object = await context.env.BUCKET.get(key);
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': totalSize.toString(),
        'Accept-Ranges': 'bytes',
      },
    });
  }

  // Parse Range header: bytes=start-end
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) {
    return new Response('Invalid range', { status: 416 });
  }

  let start = match[1] ? parseInt(match[1]) : undefined;
  let end = match[2] ? parseInt(match[2]) : undefined;

  // Handle suffix range: bytes=-500
  if (start === undefined && end !== undefined) {
    start = totalSize - end;
    end = totalSize - 1;
  }
  // Handle open-ended range: bytes=500-
  else if (end === undefined) {
    end = totalSize - 1;
  }

  // Clamp
  end = Math.min(end, totalSize - 1);
  const length = end - start + 1;

  const object = await context.env.BUCKET.get(key, {
    range: { offset: start, length },
  });

  return new Response(object.body, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Content-Length': length.toString(),
      'Accept-Ranges': 'bytes',
    },
  });
}
