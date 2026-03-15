import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { r2, BUCKET } from '../_lib/r2.js';
import { requireAuth, requireCsrf } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAuth(req, res)) return;
  if (!requireCsrf(req, res)) return;

  const { key, uploadId, parts } = req.body || {};

  if (!key || !uploadId || !Array.isArray(parts)) {
    return res.status(400).json({ error: 'Missing key, uploadId, or parts' });
  }

  const command = new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map((p) => ({
        PartNumber: p.partNumber,
        ETag: p.etag,
      })),
    },
  });

  await r2.send(command);
  res.json({ success: true, key });
}
