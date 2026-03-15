export async function onRequestPost(context) {
  const { key } = await context.request.json();

  if (!key || typeof key !== 'string') {
    return new Response('Missing key', { status: 400 });
  }

  const multipartUpload = await context.env.BUCKET.createMultipartUpload(key);

  return Response.json({
    key: multipartUpload.key,
    uploadId: multipartUpload.uploadId,
  });
}
