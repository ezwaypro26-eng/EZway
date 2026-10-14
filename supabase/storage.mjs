import { randomUUID } from 'node:crypto';
import { supabase } from './client.mjs';
export const READ_URL_EXPIRES_IN = 3600;
const initialBucket = 'ezway-media';
const CATEGORY = {
  tracks: { prefix: 'tracks/audio', family: 'audio/', max: 500 * 1024 * 1024 },
  artwork: { prefix: 'tracks/artwork', family: 'image/', max: 20 * 1024 * 1024 },
  'promo-video': { prefix: 'promo/videos', family: 'video/', max: 2 * 1024 * 1024 * 1024 },
  'message-image': { prefix: 'messages/images', family: 'image/', max: 20 * 1024 * 1024 },
  'message-attachment': { prefix: 'messages/attachments', family: null, max: 100 * 1024 * 1024 },
  'profile-image': { prefix: 'profiles', family: 'image/', max: 20 * 1024 * 1024 },
  'audio-tools-audio': { prefix: 'generated/audio', family: 'audio/', max: 1024 * 1024 * 1024 },
  'audio-tools-text': { prefix: 'generated/text', family: 'text/', max: 5 * 1024 * 1024 },
  'audio-tools-bundle': { prefix: 'generated/bundle', family: null, contentTypes: ['application/zip'], max: 2 * 1024 * 1024 * 1024 },
};

const MEDIA_PREFIXES = Object.freeze([...new Set(Object.values(CATEGORY).map((config) => config.prefix))]);

const configuredBucket = () => String(process.env.MEDIA_BUCKET || initialBucket || '').trim();

const safeRelatedId = (value) => {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(text)) throw new Error('relatedId is invalid.');
  return text;
};

const safeFilename = (value) => {
  const filename = String(value || '').trim();
  if (!filename || filename.length > 255 || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('filename is invalid.');
  }
  return filename.replace(/[^A-Za-z0-9._ -]/g, '_').replace(/\s+/g, '-');
};

const safeExistingObjectKey = (value) => {
  const objectKey = String(value || '').trim().replace(/^\/+/, '');
  if (
    !objectKey
    || objectKey.includes('..')
    || objectKey.includes('\\')
    || objectKey.includes('?')
    || objectKey.includes('#')
    || !MEDIA_PREFIXES.some((prefix) => objectKey.startsWith(`${prefix}/`))
  ) {
    throw new Error('Media object key is invalid.');
  }
  return objectKey;
};

export function normalizeUploadRequest(body = {}) {
  const category = String(body.category || '').trim();
  const config = CATEGORY[category];
  if (!config) throw new Error('Upload category is invalid.');

  const relatedId = safeRelatedId(body.relatedId ?? body.related_id);
  const filename = safeFilename(body.filename);
  const contentType = String(body.contentType ?? body.content_type ?? '').trim().toLowerCase() || 'application/octet-stream';
  if (config.family && !contentType.startsWith(config.family)) throw new Error('Upload content type is invalid for this category.');
  if (config.contentTypes && !config.contentTypes.includes(contentType)) throw new Error('Upload content type is invalid for this category.');

  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0 || size > config.max) throw new Error('Upload size is invalid for this category.');

  return { category, relatedId, filename, contentType, size };
}

export function buildObjectKey(input) {
  const category = String(input.category || '').trim();
  const config = CATEGORY[category];
  if (!config) throw new Error('Upload category is invalid.');
  const relatedId = safeRelatedId(input.relatedId ?? input.related_id);
  const filename = safeFilename(input.filename);
  return `${config.prefix}/${relatedId}/${randomUUID()}-${filename}`;
}

const objectKeyFromMediaUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Media url is required.');

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('Media url is invalid.');
  }

  const bucket = configuredBucket();
  if (!bucket) throw new Error('Media bucket is not configured.');

  if (parsed.origin !== new URL(process.env.SUPABASE_URL).origin) throw new Error('Media url is invalid.');
  const prefix = `/storage/v1/object/sign/${bucket}/`;
  if (!parsed.pathname.startsWith(prefix)) throw new Error('Media url is invalid.');
  const objectKey = parsed.pathname.slice(prefix.length);

  try {
    return safeExistingObjectKey(decodeURIComponent(objectKey));
  } catch (error) {
    if (/object key/i.test(String(error?.message || ''))) throw error;
    throw new Error('Media url is invalid.');
  }
};

export function resolveMediaObjectKey(body = {}) {
  const directKey = body.objectKey ?? body.object_key;
  if (directKey) return safeExistingObjectKey(directKey);
  if (body.url) return objectKeyFromMediaUrl(body.url);
  throw new Error('Media object key is required.');
}

const ensureBucket = () => {
  if (!configuredBucket()) throw new Error('Media bucket is not configured.');
};

export async function presignRead(objectKey) {
 if (!objectKey) return null;
 const {data,error}=await supabase().storage.from(configuredBucket()).createSignedUrl(safeExistingObjectKey(objectKey),READ_URL_EXPIRES_IN);
 if(error) throw error; return data.signedUrl;
}
export async function presignUpload(body) {
 const input=normalizeUploadRequest(body); const objectKey=buildObjectKey(input);
 const {data,error}=await supabase().storage.from(configuredBucket()).createSignedUploadUrl(objectKey);
 if(error) throw error;
 return {upload_url:data.signedUrl,object_key:objectKey,read_url:'',headers:{'content-type':input.contentType}};
}
export const uploadCategories=Object.freeze(Object.keys(CATEGORY));
