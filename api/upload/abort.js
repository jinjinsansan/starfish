import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { r2, BUCKET } from '../_lib/r2.js';
import { requireAuth, requireCsrf } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAuth(req, res)) return;
  if (!requireCsrf(req, res)) return;

  const { key, uploadId } = req.body || {};

  if (!key || !uploadId) {
    return res.status(400).json({ error: 'Missing key or uploadId' });
  }

  const command = new AbortMultipartUploadCommand({
    Bucket: BUCKET,
    Key: key,
    UploadId: uploadId,
  });

  await r2.send(command);
  res.json({ success: true });
}
