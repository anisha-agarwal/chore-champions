import { getVapidPublicKey, urlBase64ToUint8Array } from '@/lib/push/vapid'

describe('getVapidPublicKey', () => {
  const original = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  afterEach(() => {
    if (original !== undefined) {
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = original
    } else {
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    }
  })

  it('returns the key when set', () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-key'
    expect(getVapidPublicKey()).toBe('test-key')
  })

  it('throws when key is not set', () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    expect(() => getVapidPublicKey()).toThrow('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
  })

  it('throws when key is empty string', () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = ''
    expect(() => getVapidPublicKey()).toThrow('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
  })
})

describe('urlBase64ToUint8Array', () => {
  it('converts a known base64url string to Uint8Array', () => {
    // "SGVsbG8" is base64url for "Hello"
    const result = urlBase64ToUint8Array('SGVsbG8')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(Array.from(result)).toEqual([72, 101, 108, 108, 111])
  })

  it('handles padding for length % 4 == 2', () => {
    // "AQ" + "==" → 1 byte
    const result = urlBase64ToUint8Array('AQ')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(Array.from(result)).toEqual([1])
  })

  it('handles padding for length % 4 == 3', () => {
    // "AQI" + "=" → 2 bytes
    const result = urlBase64ToUint8Array('AQI')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(result.length).toBe(2)
  })

  it('handles no padding needed (length % 4 == 0)', () => {
    // "AQID" → 3 bytes
    const result = urlBase64ToUint8Array('AQID')
    expect(result).toBeInstanceOf(Uint8Array)
    expect(Array.from(result)).toEqual([1, 2, 3])
  })

  it('replaces - with + and _ with /', () => {
    // base64url uses - and _ instead of + and /
    const result = urlBase64ToUint8Array('A-B_')
    expect(result).toBeInstanceOf(Uint8Array)
  })
})
