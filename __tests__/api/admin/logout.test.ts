/**
 * @jest-environment node
 */
import { POST } from '@/app/api/admin/logout/route'

describe('POST /api/admin/logout', () => {
  it('returns 200 and clears the admin session cookie', async () => {
    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('admin_obs_session')
    expect(setCookie).toContain('Max-Age=0')
  })
})
