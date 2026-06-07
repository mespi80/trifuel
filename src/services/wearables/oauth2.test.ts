import { describe, it, expect } from 'vitest'
import { generateCodeVerifier, deriveCodeChallenge } from './oauth2'
import { createHash } from 'crypto'

describe('generateCodeVerifier', () => {
  it('returns a URL-safe base64 string', () => {
    const v = generateCodeVerifier()
    expect(/^[A-Za-z0-9_-]+$/.test(v)).toBe(true)
  })

  it('has length >= 43 characters', () => {
    const v = generateCodeVerifier()
    expect(v.length).toBeGreaterThanOrEqual(43)
  })

  it('returns different values each call', () => {
    const a = generateCodeVerifier()
    const b = generateCodeVerifier()
    expect(a).not.toBe(b)
  })
})

describe('deriveCodeChallenge', () => {
  it('returns BASE64URL(SHA256(verifier))', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const challenge = deriveCodeChallenge(verifier)
    // Manually derive expected value
    const expected = createHash('sha256').update(verifier).digest('base64url')
    expect(challenge).toBe(expected)
  })

  it('is URL-safe (no +, /, = characters)', () => {
    const challenge = deriveCodeChallenge(generateCodeVerifier())
    expect(/^[A-Za-z0-9_-]+$/.test(challenge)).toBe(true)
  })

  it('different verifiers produce different challenges', () => {
    const c1 = deriveCodeChallenge('verifier-one')
    const c2 = deriveCodeChallenge('verifier-two')
    expect(c1).not.toBe(c2)
  })

  it('same verifier always produces the same challenge', () => {
    const v = generateCodeVerifier()
    expect(deriveCodeChallenge(v)).toBe(deriveCodeChallenge(v))
  })
})
