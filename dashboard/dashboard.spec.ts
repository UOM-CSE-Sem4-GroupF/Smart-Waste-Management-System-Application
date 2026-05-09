import { test, expect } from '@playwright/test'

test.describe('Dashboard smoke tests', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/')
    // Unauthenticated users are redirected to the Keycloak login page
    await expect(page).toHaveURL(/login|signin|keycloak/i)
  })
})
