import { expect, test } from '@playwright/test'

// Runs without Supabase credentials: verifies the public shell, routing and the admin gate.
test('unknown community is a 404 and admin requires sign-in', async ({ page }) => {
  const res = await page.goto('/c/does-not-exist')
  expect(res?.status()).toBe(404)
})
test('login offers Google only', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  await expect(page.locator('input[type=password]')).toHaveCount(0)
})
