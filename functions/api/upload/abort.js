export async function onRequestPost(context) {
  const { key, uploadId } = await context.request.json();

  if (!key || !uploadId) {
    return new Response('Missing key or uploadId', { status: 400 });
  }

  const multipartUpload = context.env.BUCKET.resumeMultipartUpload(key, uploadId);
  await multipartUpload.abort();

  return Response.json({ success: true });
}
