import { ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { r2, BUCKET } from './_lib/r2.js';
import { requireAuth, requireCsrf } from './_lib/auth.js';

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'ogv']);

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method === 'GET') {
    const prefix = req.query.prefix || '';

    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      Delimiter: '/',
      MaxKeys: 1000,
    });

    const result = await r2.send(command);

    const folders = (result.CommonPrefixes || []).map((p) => ({
      name: p.Prefix.replace(prefix, '').replace(/\/$/, ''),
      prefix: p.Prefix,
      type: 'folder',
    }));

    const videos = (result.Contents || [])
      .filter((obj) => {
        if (obj.Key.startsWith('_thumbs/')) return false;
        const ext = obj.Key.split('.').pop().toLowerCase();
        return VIDEO_EXTENSIONS.has(ext);
      })
      .sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified))
      .map((obj) => ({
        key: obj.Key,
        name: obj.Key.replace(prefix, ''),
        size: obj.Size,
        uploaded: new Date(obj.LastModified).toISOString(),
        type: 'video',
      }));

    return res.json({ folders, videos });
  }

  if (req.method === 'DELETE') {
    if (!requireCsrf(req, res)) return;

    const { key } = req.body || {};
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Missing key' });
    }

    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: `_thumbs/${key}.jpg` }));

    return res.json({ success: true });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
