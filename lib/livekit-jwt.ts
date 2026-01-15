/**
 * LiveKit JWT Token Generation Utilities
 *
 * Cloudflare-compatible JWT token generation for LiveKit
 * Uses @tsndr/cloudflare-worker-jwt instead of livekit-server-sdk
 *
 * Based on:
 * - LiveKit JWT specification: https://docs.livekit.io/home/get-started/authentication/
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

/**
 * LiveKit Video Grant structure
 * Defines permissions for a participant in a room
 */
export interface VideoGrant {
  room?: string;
  roomJoin?: boolean;
  roomList?: boolean;
  roomRecord?: boolean;
  roomAdmin?: boolean;
  roomCreate?: boolean;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  hidden?: boolean;
  recorder?: boolean;
}

/**
 * Token generation options
 */
export interface TokenOptions {
  identity: string;
  name?: string;
  metadata?: string;
  attributes?: Record<string, string>;
}

/**
 * Generate LiveKit JWT token compatible with Cloudflare Workers
 *
 * This replaces livekit-server-sdk's AccessToken class which is
 * incompatible with Cloudflare Workers due to Node.js binary dependencies.
 *
 * @param apiKey - LiveKit API key (from env.LIVEKIT_API_KEY)
 * @param apiSecret - LiveKit API secret (from env.LIVEKIT_API_SECRET)
 * @param options - Token options (identity, name, metadata)
 * @param grant - Video grant permissions
 * @param ttlSeconds - Token TTL in seconds (default: 5 minutes)
 * @returns JWT token string
 */
export async function generateLiveKitToken(
  apiKey: string,
  apiSecret: string,
  options: TokenOptions,
  grant: VideoGrant,
  ttlSeconds: number = 5 * 60
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Build JWT claims following LiveKit spec
  const claims: Record<string, unknown> = {
    // LiveKit-specific video grant
    video: grant,

    // Standard JWT claims
    sub: options.identity, // Subject (participant identity)
    iss: apiKey, // Issuer (API key)
    nbf: now, // Not before
    exp: now + ttlSeconds, // Expires
  };

  // Optional claims
  if (options.name) {
    claims.name = options.name;
  }
  if (options.metadata) {
    claims.metadata = options.metadata;
  }
  if (options.attributes) {
    claims.attributes = options.attributes;
  }

  // Sign with HS256 algorithm (LiveKit default)
  return await jwt.sign(claims, apiSecret);
}

/**
 * Helper to generate a random identity string
 */
export function generateIdentity(prefix: string = 'user'): string {
  const random = Math.random().toString(36).substring(7);
  const timestamp = Date.now();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Helper to generate a random alphanumeric string
 */
export function generateRandomAlphanumeric(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Decoded token payload with metadata
 */
export interface DecodedTokenPayload {
  sub: string; // identity
  name?: string;
  metadata?: string;
  video?: VideoGrant;
  iss: string;
  nbf: number;
  exp: number;
}

/**
 * Verify and decode a LiveKit JWT token
 *
 * @param token - JWT token string
 * @param apiSecret - LiveKit API secret for verification
 * @returns Decoded payload or null if invalid
 */
export async function verifyLiveKitToken(
  token: string,
  apiSecret: string
): Promise<DecodedTokenPayload | null> {
  try {
    const isValid = await jwt.verify(token, apiSecret);
    if (!isValid) {
      return null;
    }

    const decoded = jwt.decode(token);
    return decoded.payload as DecodedTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Extract metadata from a verified token
 */
export function extractMetadataFromToken(payload: DecodedTokenPayload): Record<string, unknown> | null {
  try {
    if (payload.metadata) {
      return JSON.parse(payload.metadata);
    }
  } catch {
    // Invalid metadata JSON
  }
  return null;
}
