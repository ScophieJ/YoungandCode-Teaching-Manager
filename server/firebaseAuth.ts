import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CertCache | null = null;

function readFirebaseProjectId(): string {
  const envProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (envProjectId) return envProjectId;

  const configPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as { projectId?: string };
  if (!parsed.projectId) {
    throw new Error('Firebase projectId is missing in firebase-applet-config.json.');
  }
  return parsed.projectId;
}

function decodeBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && now < certCache.expiresAt) {
    return certCache.certs;
  }

  const response = await fetch(GOOGLE_CERTS_URL);
  if (!response.ok) {
    throw new Error('Unable to fetch Firebase token verification certificates.');
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  const certs = (await response.json()) as Record<string, string>;

  certCache = {
    certs,
    expiresAt: now + Math.max(60, maxAgeSec) * 1000,
  };
  return certs;
}

export interface VerifiedTeacherToken {
  uid: string;
  email?: string;
}

export async function verifyFirebaseBearerToken(
  authorizationHeader: string | undefined
): Promise<VerifiedTeacherToken> {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required. Please sign in again.');
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('Invalid authentication token format.');
  }

  const [headerB64, payloadB64, signatureB64] = segments;
  let header: { alg?: string; kid?: string };
  let payload: {
    aud?: string;
    iss?: string;
    sub?: string;
    user_id?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
  };

  try {
    header = JSON.parse(decodeBase64Url(headerB64).toString('utf8'));
    payload = JSON.parse(decodeBase64Url(payloadB64).toString('utf8'));
  } catch {
    throw new Error('Unable to decode authentication token.');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported authentication token algorithm.');
  }

  const certs = await getGooglePublicCerts();
  const pem = certs[header.kid];
  if (!pem) {
    throw new Error('Authentication key could not be verified. Please sign in again.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signatureValid = verifier.verify(pem, decodeBase64Url(signatureB64));
  if (!signatureValid) {
    throw new Error('Invalid authentication token signature.');
  }

  const projectId = readFirebaseProjectId();
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const nowSec = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) {
    throw new Error('Authentication token audience mismatch.');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('Authentication token issuer mismatch.');
  }
  const uid = payload.sub || payload.user_id || '';
  if (!uid || uid.length > 128) {
    throw new Error('Authentication token subject is missing.');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Your sign-in session has expired. Please refresh and try again.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Authentication token issue time is invalid.');
  }
  if (payload.email_verified !== true) {
    throw new Error('A verified Google account is required.');
  }

  return {
    uid,
    email: payload.email,
  };
}
