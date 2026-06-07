/**
 * AES-256-GCM symmetric encryption for OAuth token storage.
 *
 * Wire format (base64-encoded): IV(12) ‖ AuthTag(16) ‖ Ciphertext(N)
 *
 * ENCRYPTION_KEY env var: accept either a 64-char hex string (32 raw bytes)
 * or any string (SHA-256 derived). Never log or expose the key.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // recommended for GCM
const TAG_BYTES = 16 // GCM auth tag length

/** @internal */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY env var is required')
  // Accept 64-char hex → 32 raw bytes; fall back to SHA-256 of arbitrary string
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex')
  return createHash('sha256').update(raw).digest()
}

/**
 * Encrypts a UTF-8 plaintext string and returns a base64 string.
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

/**
 * Decrypts a base64 string produced by {@link encrypt}.
 * Throws on authentication failure (tampered ciphertext).
 */
export function decrypt(encoded: string): string {
  const key = getKey()
  const data = Buffer.from(encoded, 'base64')
  if (data.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('Invalid ciphertext: too short')
  }
  const iv = data.subarray(0, IV_BYTES)
  const tag = data.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = data.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
