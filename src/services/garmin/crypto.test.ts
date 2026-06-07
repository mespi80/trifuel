/**
 * Tests for AES-256-GCM token encryption.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Set a known key before importing the module under test
beforeEach(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes
})

// Import lazily so the env var is set first
async function loadCrypto() {
  // Re-import in each test to pick up env changes if needed
  return import('./crypto')
}

describe('encrypt / decrypt', () => {
  it('roundtrips an ASCII string', async () => {
    const { encrypt, decrypt } = await loadCrypto()
    const plaintext = 'hello, world'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('roundtrips a long token string', async () => {
    const { encrypt, decrypt } = await loadCrypto()
    const token = 'a'.repeat(512) + '🔑'
    expect(decrypt(encrypt(token))).toBe(token)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const { encrypt } = await loadCrypto()
    const a = encrypt('same-input')
    const b = encrypt('same-input')
    expect(a).not.toBe(b)
  })

  it('decrypted value is base64-encoded', async () => {
    const { encrypt } = await loadCrypto()
    const enc = encrypt('test')
    expect(() => Buffer.from(enc, 'base64')).not.toThrow()
  })

  it('throws on tampered ciphertext (auth tag mismatch)', async () => {
    const { encrypt, decrypt } = await loadCrypto()
    const enc = encrypt('sensitive-token')
    const buf = Buffer.from(enc, 'base64')
    // Flip a byte in the ciphertext section (after IV(12) + tag(16) = 28 bytes)
    buf[29]! ^= 0xff
    expect(() => decrypt(buf.toString('base64'))).toThrow()
  })

  it('throws on ciphertext that is too short', async () => {
    const { decrypt } = await loadCrypto()
    const tooShort = Buffer.from('short').toString('base64')
    expect(() => decrypt(tooShort)).toThrow('Invalid ciphertext: too short')
  })

  it('accepts a SHA-256-derived key (non-hex ENCRYPTION_KEY)', async () => {
    process.env.ENCRYPTION_KEY = 'arbitrary-passphrase-not-hex'
    const { encrypt, decrypt } = await loadCrypto()
    const plaintext = 'token-value'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })
})
