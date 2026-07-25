import { expect, test } from '@playwright/test'

// Public surface — no auth, no test account needed. Runs against a signed-out
// browser context (Playwright starts each test with a fresh one).
test.describe('smoke (auth gerektirmez)', () => {
  test('/sign-in sayfası render olur', async ({ page }) => {
    await page.goto('/sign-in')

    await expect(
      page.getByRole('heading', { name: 'Tekrar hoş geldin.', exact: true }),
    ).toBeVisible()
    await expect(page.getByLabel('E-posta')).toBeVisible()
    await expect(page.getByLabel('Şifre', { exact: true })).toBeVisible()
    // Button reads "Yükleniyor..." until the Clerk client loads, then "Giriş Yap".
    await expect(page.getByRole('button', { name: /Giriş Yap|Yükleniyor/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Hesap oluştur' })).toBeVisible()
  })

  test('/sign-up sayfası render olur', async ({ page }) => {
    await page.goto('/sign-up')

    await expect(page.getByLabel('E-posta')).toBeVisible()
    await expect(page.getByLabel('Şifre', { exact: true })).toBeVisible()
  })

  test('çıkış durumunda / → /sign-in yönlendirir', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/sign-in/)
  })

  // Middleware bounces signed-out users to /sign-in (with redirect_url param).
  for (const path of ['/modules', '/hospital', '/dashboard']) {
    test(`çıkış durumunda ${path} → /sign-in yönlendirir`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveURL(/\/sign-in/)
    })
  }
})
