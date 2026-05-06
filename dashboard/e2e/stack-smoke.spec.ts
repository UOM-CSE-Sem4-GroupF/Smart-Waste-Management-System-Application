import { test, expect } from '@playwright/test'

const kongUrl = process.env.KONG_URL || ''

test.describe('Stack smoke', () => {
  test.skip(!process.env.KONG_URL, 'KONG_URL not set')

  test('public endpoints respond', async ({ request }) => {
    const endpoints = ['/api/v1/bins', '/api/v1/collection-jobs', '/api/v1/drivers/available']

    for (const path of endpoints) {
      const resp = await request.get(`${kongUrl}${path}`)
      expect([404, 502, 503]).not.toContain(resp.status())
    }
  })
})
