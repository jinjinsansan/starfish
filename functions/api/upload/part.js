export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const key = url.searchParams.get('key');
  const uploadId = url.searchParams.get('uploadId');
  const partNumber = parseInt(url.searchParams.get('partNumber'));

  if (!key || !uploadId || isNaN(partNumber)) {
    return new Response('Missing key, uploadId, or partNumber', { status: 400 });
  }

  const multipartUpload = context.env.BUCKET.resumeMultipartUpload(key, uploadId);
  const part = await multipartUpload.uploadPart(partNumber, context.request.body);

  return Response.json({
    partNumber: part.partNumber,
    etag: part.etag,
  });
}
