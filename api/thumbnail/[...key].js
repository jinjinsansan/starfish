import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, BUCKET } from '../_lib/r2.js';
import { requireAuth, requireCsrf } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  const rawKey = Array.isArray(req.query.key)
    ? req.query.key.join('/')
    : req.query.key;
  const thumbKey = `_thumbs/${rawKey}.jpg`;

  // GET: redirect to presigned R2 URL for viewing thumbnail
  if (req.method === 'GET') {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: thumbKey,
    });
    const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
    return res.redirect(302, url);
  }

  // POST: return presigned PUT URL for uploading thumbnail
  if (req.method === 'POST') {
    if (!requireCsrf(req, res)) return;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: thumbKey,
      ContentType: 'image/jpeg',
    });
    const url = await getSignedUrl(r2, command, { expiresIn: 600 });
    return res.json({ url });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
