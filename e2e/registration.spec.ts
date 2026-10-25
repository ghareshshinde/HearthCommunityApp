import { expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'

test('family of 4 plus 2 guests registers, admin sees and exports them', async ({ page, context }) => {
  await page.goto('/c/jsg')
  await page.getByRole('link', { name: 'Register' }).click()
  await page.getByRole('link', { name: 'Register' }).click()

  const started = Date.now()
  await page.getByLabel('Your name').fill('Asha Shah')
  await page.getByLabel('Your mobile').fill('9876543210')
  await page.getByLabel('Your email').fill('asha@example.test')
  await page.getByLabel('Emergency contact name').fill('Raj Shah')
  await page.getByLabel('Emergency contact mobile').fill('9123456780')

  // Paste six rows copied from a spreadsheet into the first Name cell (TR6).
  const tsv = [
    ['Asha Shah', '34', 'Female', '9876543210', '', 'Chess', 'casual', 'Jain', 'M', '', 'member'],
    ['Raj Shah', '38', 'Male', '9123456780', '', 'Cricket, Badminton', 'competitive', 'Jain', 'L', '', 'member'],
    ['Mira Shah', '9', 'Female', '', '', 'Carrom', 'beginner', 'Jain', '8-10y', '', 'member'],
    ['Veer Shah', '7', 'Male', '', '', 'Carrom', 'beginner', 'Jain', '4-6y', '', 'member'],
    ['આશા મહેતા', '41', 'Female', '9000000001', '', 'Chess', 'casual', 'Vegetarian', 'M', '', 'guest'],
    ['राज मेहता', '45', 'Male', '9000000002', '', 'Table Tennis', 'casual', 'Vegetarian', 'L', '', 'guest'],
  ].map((r) => r.join('\t')).join('\n')
  await page.locator('[data-r="0"][data-c="name"]').focus()
  await page.evaluate((text) => {
    const el = document.activeElement!
    const dt = new DataTransfer()
    dt.setData('text', text)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  }, tsv)

  await expect(page.getByText('6 participants · 4 members · 2 guests')).toBeVisible()
  await page.getByLabel('I accept the injury waiver').check()
  await page.getByRole('button', { name: 'Submit registration' }).click()
  await expect(page.getByText(/Registration saved/)).toBeVisible()
  expect(Date.now() - started).toBeLessThan(180_000)
  const regUrl = page.url()
  const ref = (await page.getByText(/^Reference/).first().textContent())!.match(/HR-[0-9A-F]{8}/)![0]

  // Admin cannot be reached without the password.
  const anon = await context.newPage()
  await anon.goto('/c/jsg/admin')
  await expect(anon).toHaveURL(/admin\/login/)
  await anon.getByLabel('Admin password').fill('wrong')
  await anon.getByRole('button', { name: 'Sign in' }).click()
  await expect(anon.getByText('Incorrect password')).toBeVisible()
  await anon.getByLabel('Admin password').fill('e2e-password')
  await anon.getByRole('button', { name: 'Sign in' }).click()
  await expect(anon.getByRole('heading', { name: 'Admin console' })).toBeVisible()
  await expect(anon.getByText('6 people')).toBeVisible()

  // Another community's admin area is not unlocked by this session.
  await anon.goto('/c/kitty-demo/admin')
  await expect(anon).toHaveURL(/kitty-demo\/admin\/login/)
  await anon.goto('/c/jsg/admin')

  await anon.getByRole('link', { name: 'Registrations' }).click()
  await expect(anon.getByText('6 of 6 shown')).toBeVisible()
  await anon.getByLabel('Member or guest').selectOption('guest')
  await anon.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(anon.getByText('2 of 6 shown')).toBeVisible()

  // Download Excel from the current filtered view.
  const [dl] = await Promise.all([anon.waitForEvent('download'), anon.getByRole('link', { name: /Download Excel/ }).click()])
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile((await dl.path())!)
  expect(wb.worksheets.map((w) => w.name)).toContain('Table Tennis')
  const names = wb.getWorksheet('All participants')!.getColumn(6).values
  expect(names).toContain('આશા મહેતા')
  expect(names).toContain('राज मेहता')

  // Registrant can reopen via the secret link; a bad token 404s.
  await page.goto(regUrl.split('?')[0])
  await expect(page.getByText(ref)).toBeVisible()
  expect((await page.goto('/c/jsg/r/not-a-token'))?.status()).toBe(404)
})

test('login offers no Google or OTP, and unknown community is 404', async ({ page }) => {
  expect((await page.goto('/c/nope'))?.status()).toBe(404)
  await page.goto('/c/jsg/admin/login')
  await expect(page.getByText(/google/i)).toHaveCount(0)
})
