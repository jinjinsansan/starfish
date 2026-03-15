export async function onRequestPost(context) {
  const { key, uploadId, parts } = await context.request.json();

  if (!key || !uploadId || !Array.isArray(parts)) {
    return new Response('Missing key, uploadId, or parts', { status: 400 });
  }

  const multipartUpload = context.env.BUCKET.resumeMultipartUpload(key, uploadId);
  await multipartUpload.complete(parts);

  return Response.json({ success: true, key });
}
