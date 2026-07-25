import { expect, test } from '@playwright/test'
import { HAS_TEST_CREDENTIALS, MISSING_CREDENTIALS_REASON, signInWithTestUser } from './helpers'

test.describe('/hospital (authenticated)', () => {
  test.skip(!HAS_TEST_CREDENTIALS, MISSING_CREDENTIALS_REASON)

  test.beforeEach(async ({ page }) => {
    await signInWithTestUser(page)
  })

  test('KVKK gate görünür, onay sonrası workspace açılır', async ({ page }) => {
    await page.goto('/hospital')

    // Module header is behind auth but above the gate.
    await expect(page.getByRole('heading', { name: /Hastane\s+Anamnez/ })).toBeVisible()

    // KVKK gate locks the workspace (fresh context → consent never stored).
    await expect(
      page.getByRole('heading', { name: /KVKK Aydınlatma ve Onay — Hastane Modülü/ }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Hasta Kimliği' })).not.toBeVisible()

    // Accept button stays disabled until the consent box is ticked.
    const accept = page.getByRole('button', { name: 'Onaylıyorum ve Devam Et' })
    await expect(accept).toBeDisabled()
    await page.getByRole('checkbox').check()
    await expect(accept).toBeEnabled()
    await accept.click()

    // Workspace: identity panel, mode toggle, recording panel.
    await expect(page.getByRole('heading', { name: 'Hasta Kimliği' })).toBeVisible()
    await expect(page.getByLabel('Ad', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Soyad', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Anamnez Modu' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hızlı (Acil)', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Detaylı (Poliklinik)', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Kayıt', exact: true })).toBeVisible()

    // Gate is gone after consent.
    await expect(
      page.getByRole('heading', { name: /KVKK Aydınlatma ve Onay/ }),
    ).not.toBeVisible()
  })
})
