import { describe, expect, it } from 'vitest'

import { decodeIntakeToken } from './intake-token'

/**
 * Two bugs met in this function, and both were invisible from the patient's
 * side: a padded token arrived percent-encoded and every link ending in `=` was
 * dead, and the route matched every single-segment path so `/pateints` rendered
 * "link not found" instead of a 404.
 */

/** The base64 of `{"iv":` — how every real token starts. */
const PREFIX = 'eyJpdiI6'

/** Long enough to clear the length floor, shaped like the real thing. */
const body = 'A'.repeat(80)
const TOKEN = PREFIX + body
const PADDED = PREFIX + body + '=='

describe('decodeIntakeToken', () => {
  it('returns a well-formed token unchanged', () => {
    expect(decodeIntakeToken(TOKEN)).toBe(TOKEN)
  })

  /**
   * The bug that killed roughly two links in three: base64 padding reaches the
   * page as `%3D`, and the API cannot decrypt a token with `%3D` where its `=`
   * should be. Returning the repaired value is the whole point — a boolean would
   * have left the caller holding the broken string.
   */
  it('repairs percent-encoded padding', () => {
    expect(decodeIntakeToken(PREFIX + body + '%3D%3D')).toBe(PADDED)
    expect(decodeIntakeToken(PREFIX + body + '%3d%3d')).toBe(PADDED)
  })

  it('accepts a token that already has its padding', () => {
    expect(decodeIntakeToken(PADDED)).toBe(PADDED)
  })

  describe('refuses what is not a token, so the route can 404', () => {
    it('refuses an ordinary mistyped path', () => {
      expect(decodeIntakeToken('pateints')).toBeNull()
      expect(decodeIntakeToken('schedule')).toBeNull()
      expect(decodeIntakeToken('favicon.ico')).toBeNull()
    })

    it('refuses anything too short to be one', () => {
      expect(decodeIntakeToken(PREFIX)).toBeNull()
      expect(decodeIntakeToken(PREFIX + 'A'.repeat(10))).toBeNull()
    })

    it('refuses a long string that is not the envelope', () => {
      expect(decodeIntakeToken('B'.repeat(120))).toBeNull()
    })

    it('refuses base64 that is not standard', () => {
      // URL-safe base64 uses - and _, which the token envelope never emits.
      expect(decodeIntakeToken(PREFIX + 'A'.repeat(70) + '-_')).toBeNull()
    })

    it('refuses a malformed percent-escape rather than throwing', () => {
      expect(decodeIntakeToken('%E0%A4%A')).toBeNull()
      expect(decodeIntakeToken(PREFIX + body + '%')).toBeNull()
    })

    it('refuses an empty segment', () => {
      expect(decodeIntakeToken('')).toBeNull()
    })
  })
})
