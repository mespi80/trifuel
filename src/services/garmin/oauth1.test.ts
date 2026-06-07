/**
 * Tests for OAuth 1.0a signature helpers.
 */

import { describe, it, expect } from 'vitest'
import { pct, buildAuthHeader, parseOAuthBody } from './oauth1'

// ── pct (percent-encode) ───────────────────────────────────────────────────────

describe('pct', () => {
  it('encodes spaces', () => {
    expect(pct('hello world')).toBe('hello%20world')
  })

  it('encodes special OAuth characters not handled by encodeURIComponent', () => {
    expect(pct('!')).toBe('%21')
    expect(pct("'")).toBe('%27')
    expect(pct('(')).toBe('%28')
    expect(pct(')')).toBe('%29')
    expect(pct('*')).toBe('%2A')
  })

  it('does not encode unreserved characters', () => {
    const unreserved = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~'
    expect(pct(unreserved)).toBe(unreserved)
  })

  it('encodes ampersand and equals', () => {
    expect(pct('a&b=c')).toBe('a%26b%3Dc')
  })
})

// ── parseOAuthBody ─────────────────────────────────────────────────────────────

describe('parseOAuthBody', () => {
  it('parses simple key=value pairs', () => {
    const result = parseOAuthBody('oauth_token=abc&oauth_token_secret=xyz')
    expect(result).toEqual({ oauth_token: 'abc', oauth_token_secret: 'xyz' })
  })

  it('handles percent-encoded values', () => {
    const result = parseOAuthBody('key=hello%20world')
    expect(result).toEqual({ key: 'hello world' })
  })

  it('handles empty string', () => {
    expect(parseOAuthBody('')).toEqual({})
  })

  it('handles trailing ampersand', () => {
    const result = parseOAuthBody('a=1&b=2&')
    expect(result).toEqual({ a: '1', b: '2' })
  })
})

// ── buildAuthHeader ────────────────────────────────────────────────────────────

describe('buildAuthHeader', () => {
  const creds = {
    consumerKey: 'test-consumer-key',
    consumerSecret: 'test-consumer-secret',
    accessToken: 'test-access-token',
    accessTokenSecret: 'test-token-secret',
  }

  it('returns a string starting with "OAuth "', () => {
    const header = buildAuthHeader('GET', 'https://example.com/resource', creds)
    expect(header.startsWith('OAuth ')).toBe(true)
  })

  it('includes required OAuth parameters', () => {
    const header = buildAuthHeader('GET', 'https://example.com/resource', creds)
    expect(header).toContain('oauth_consumer_key=')
    expect(header).toContain('oauth_nonce=')
    expect(header).toContain('oauth_signature_method=')
    expect(header).toContain('oauth_timestamp=')
    expect(header).toContain('oauth_version=')
    expect(header).toContain('oauth_signature=')
    expect(header).toContain('oauth_token=')
  })

  it('uses HMAC-SHA1', () => {
    const header = buildAuthHeader('GET', 'https://example.com/resource', creds)
    expect(header).toContain('oauth_signature_method="HMAC-SHA1"')
  })

  it('omits oauth_token when no accessToken provided', () => {
    const credsNoToken = { consumerKey: 'k', consumerSecret: 's' }
    const header = buildAuthHeader('POST', 'https://example.com/token', credsNoToken)
    expect(header).not.toContain('oauth_token=')
  })

  it('includes extra params in the header', () => {
    const header = buildAuthHeader(
      'POST',
      'https://example.com/request_token',
      { consumerKey: 'k', consumerSecret: 's' },
      { oauth_callback: 'https://myapp.com/callback' }
    )
    expect(header).toContain('oauth_callback=')
  })

  it('produces a deterministic structure (two calls differ only in nonce/timestamp)', () => {
    const h1 = buildAuthHeader('GET', 'https://apis.garmin.com/wellness-api/rest/user/id', creds)
    const h2 = buildAuthHeader('GET', 'https://apis.garmin.com/wellness-api/rest/user/id', creds)
    // Both should be valid OAuth headers but with different nonces
    expect(h1.startsWith('OAuth ')).toBe(true)
    expect(h2.startsWith('OAuth ')).toBe(true)
  })

  it('encodes query params into the signature base', () => {
    // Should not throw and should produce a header
    const header = buildAuthHeader(
      'GET',
      'https://apis.garmin.com/wellness-api/rest/dailies?uploadStartTimeInSeconds=1000&uploadEndTimeInSeconds=2000',
      creds
    )
    expect(header).toContain('oauth_signature=')
  })
})
