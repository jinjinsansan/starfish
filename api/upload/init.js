import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { r2, BUCKET } from '../_lib/r2.js';
import { requireAuth, requireCsrf } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAuth(req, res)) return;
  if (!requireCsrf(req, res)) return;

  const { key, totalParts, contentType } = req.body || {};

  if (!key || !totalParts || totalParts < 1) {
    return res.status(400).json({ error: 'Missing key or totalParts' });
  }

  // Create multipart upload
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });
  const { UploadId } = await r2.send(createCommand);

  // Generate presigned URLs for each part
  const presignedUrls = [];
  for (let i = 1; i <= totalParts; i++) {
    const partCommand = new UploadPartCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId,
      PartNumber: i,
    });
    const url = await getSignedUrl(r2, partCommand, { expiresIn: 3600 });
    presignedUrls.push(url);
  }

  res.json({ uploadId: UploadId, presignedUrls });
}
