import { expect, type Page } from '@playwright/test'

// Authenticated specs run only when a real Clerk test account is provided via
// env. The account must be a normal (non-superadmin) user without 2FA/MFA
// enrolled — otherwise the sign-in flow lands on the 2FA or tasks step.
export const TEST_EMAIL = process.env.CLERK_TEST_EMAIL
export const TEST_PASSWORD = process.env.CLERK_TEST_PASSWORD
export const HAS_TEST_CREDENTIALS = Boolean(TEST_EMAIL && TEST_PASSWORD)

export const MISSING_CREDENTIALS_REASON =
  'CLERK_TEST_EMAIL / CLERK_TEST_PASSWORD env değişkenleri tanımlı değil — authenticated testler atlanıyor'

/**
 * Signs in through the real /sign-in UI with the env-provided test account.
 * Caller spec must be guarded with test.skip(!HAS_TEST_CREDENTIALS).
 */
export async function signInWithTestUser(page: Page) {
  await page.goto('/sign-in')
  await page.getByLabel('E-posta').fill(TEST_EMAIL!)
  await page.getByLabel('Şifre', { exact: true }).fill(TEST_PASSWORD!)

  // Submit reads "Yükleniyor..." until the Clerk client is ready — wait for
  // the enabled "Giriş Yap" state instead of a fixed sleep.
  const submit = page.getByRole('button', { name: 'Giriş Yap', exact: true })
  await expect(submit).toBeEnabled()
  await submit.click()

  // Successful sign-in pushes '/', which server-redirects to /modules.
  await expect(page).toHaveURL(/\/modules/, { timeout: 30_000 })
}
