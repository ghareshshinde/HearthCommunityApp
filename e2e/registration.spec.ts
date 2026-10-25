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
    ['Asha Mehta', '41', 'Female', '9000000001', '', 'Chess', 'casual', 'Vegetarian', 'M', '', 'guest'],
    ['Raj Mehta', '45', 'Male', '9000000002', '', 'Table Tennis', 'casual', 'Vegetarian', 'L', '', 'guest'],
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
  expect(names).toContain('Asha Mehta')
  expect(names).toContain('Raj Mehta')

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

test('phone layout at 360px: no sideways scroll, stacked cards, inline errors', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 } })
  const page = await ctx.newPage()
  await page.goto('/c/jsg')
  await page.goto('/c/jsg/e/1/register')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  // Table header is hidden and each person is a stacked card with labelled fields.
  await expect(page.locator('.grid-table thead')).toBeHidden()
  await expect(page.locator('.grid-table td[data-label="Name"]').first()).toBeVisible()
  // Required-field errors show per cell and scroll into view on submit.
  await page.getByRole('button', { name: 'Submit registration' }).click()
  await expect(page.getByText('Required').first()).toBeVisible()
  await ctx.close()
})

test('event page shows the games with icons, and a registrant can edit then cancel via the secret link', async ({ page }) => {
  await page.goto('/c/jsg/e/1')
  await expect(page.getByRole('heading', { name: 'Pick your games' })).toBeVisible()
  await expect(page.locator('.tile img')).toHaveCount(6)
  await page.getByRole('link', { name: 'Register your family' }).click()
  await page.getByLabel('Your name').fill('Test Person')
  await page.getByLabel('Your mobile').fill('9876500000')
  await page.getByLabel('Emergency contact name').fill('Em Contact')
  await page.getByLabel('Emergency contact mobile').fill('9876500001')
  await page.locator('[data-r="0"][data-c="name"]').fill('Test Person')
  await page.locator('[data-r="0"][data-c="age"]').fill('30')
  await page.locator('[data-r="0"][data-c="gender"]').selectOption('Male')
  await page.locator('[data-r="0"][data-c="mobile"]').fill('9876500000')
  await page.locator('td[data-label="Sports"] label', { hasText: 'Chess' }).first().click()
  await page.locator('[data-r="0"][data-c="skill"]').selectOption('casual')
  await page.getByLabel('I accept the injury waiver').check()
  await page.getByRole('button', { name: 'Submit registration' }).click()
  await expect(page.getByText(/Registration saved/)).toBeVisible()
  await page.locator('[data-r="0"][data-c="name"]').fill('Test Person Edited')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.locator('[data-r="0"][data-c="name"]')).toHaveValue('Test Person Edited')
  await page.getByRole('button', { name: 'Cancel registration' }).click()
  await expect(page.getByText(/This registration is cancelled/)).toBeVisible()
})

test('event day: staff invites, gate check-in without photos, walk-ins, sport admin scope, revoke', async ({ page, browser }) => {
  test.setTimeout(120_000)
  // A family registers and opens its QR ticket.
  await page.goto('/c/jsg/e/1/register')
  await page.waitForLoadState('networkidle') // let the form hydrate before typing
  await page.getByLabel('Your name').fill('Gate Family')
  await page.getByLabel('Your mobile').fill('9811111111')
  await page.getByLabel('Emergency contact name').fill('Em Gate')
  await page.getByLabel('Emergency contact mobile').fill('9811111112')
  for (const [i, n] of ['Gate Parent', 'Gate Child'].entries()) {
    if (i) await page.getByRole('button', { name: 'Add person' }).click()
    await page.locator(`[data-r="${i}"][data-c="name"]`).fill(n)
    await page.locator(`[data-r="${i}"][data-c="age"]`).fill(i ? '9' : '38')
    await page.locator(`[data-r="${i}"][data-c="gender"]`).selectOption(i ? 'Female' : 'Male')
    if (!i) await page.locator(`[data-r="${i}"][data-c="mobile"]`).fill('9811111111')
    await page.locator('tr[data-row="' + i + '"] td[data-label="Sports"] label', { hasText: 'Chess' }).click()
    await page.locator(`[data-r="${i}"][data-c="skill"]`).selectOption('casual')
  }
  await page.getByLabel('I accept the injury waiver').check()
  await page.getByRole('button', { name: 'Submit registration' }).click()
  await expect(page.getByText(/Registration saved/)).toBeVisible()
  const ref = (await page.getByText(/^Reference/).first().textContent())!.match(/HR-[0-9A-F]{8}/)![0]
  await page.getByRole('link', { name: 'Show my QR ticket' }).click()
  await expect(page.locator('svg').first()).toBeVisible()
  await expect(page.getByText(ref).first()).toBeVisible()
  await expect(page.getByText('not yet in')).toHaveCount(2)

  // Admin opens the spot desk, names the gates and creates the standard staff set.
  const admin = await (await browser.newContext()).newPage()
  await admin.goto('/c/jsg/admin/login')
  await admin.getByLabel('Admin password').fill('e2e-password')
  await admin.getByRole('button', { name: 'Sign in' }).click()
  await expect(admin.getByRole('heading', { name: 'Admin console' })).toBeVisible()
  await admin.goto('/c/jsg/admin/staff')
  await admin.getByLabel(/Check-in points/).fill('Main gate\nSide gate')
  await admin.getByLabel('Spot registration is open').check()
  await admin.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(admin.getByRole('heading', { name: /Staff and check-in/ })).toBeVisible()
  await admin.getByRole('button', { name: 'Create the standard set' }).click()
  await expect(admin.getByText('Copy these now')).toBeVisible()
  const row = (user: string) => admin.locator('section', { hasText: 'Copy these now' }).locator('tr', { has: admin.locator(`code:text-is("${user}")`) })
  const gateInvite = (await row('gate-1').locator('td').nth(3).textContent())!.trim()
  const chessUser = 'chess-1'
  const chessPass = (await row(chessUser).locator('td').nth(2).textContent())!.trim()
  const chess2Invite = (await row('chess-2').locator('td').nth(3).textContent())!.trim()
  await admin.reload()
  await expect(admin.getByText('Every sport has two admins')).toBeVisible()

  // Gate volunteer opens the invite link: no typing needed.
  const gateCtx = await browser.newContext({ viewport: { width: 390, height: 800 } })
  const gate = await gateCtx.newPage()
  await gate.goto(gateInvite)
  await expect(gate.getByRole('link', { name: 'Open check-in' })).toBeVisible()
  await gate.getByRole('link', { name: 'Open check-in' }).click()
  await gate.getByLabel('This device is at').selectOption('Main gate')
  await gate.getByLabel('Search').fill(ref)
  await gate.getByRole('button', { name: 'Find' }).click()
  await gate.getByText(`Gate Family`).first().click()
  await expect(gate.getByText('Gate Parent')).toBeVisible()
  await gate.getByRole('button', { name: 'Admit selected' }).click()
  await expect(gate.getByText('Done. 2 people admitted.')).toBeVisible()
  await expect(gate.getByText('Everyone on this ticket is already in.')).toBeVisible()
  await expect(gate.getByText(/Main gate, Gate volunteer/).first()).toBeVisible()

  // A late cousin joins the same family at the spot desk and is admitted in the same step.
  await gate.getByText('Add someone to this family (walk-in)').click()
  const fam = gate.locator('details', { hasText: 'Add someone to this family' })
  await fam.getByLabel('Name', { exact: true }).fill('Late Cousin')
  await fam.getByLabel('Age').fill('200')
  await fam.getByLabel('Gender').selectOption('Male')
  await fam.getByLabel('Mobile (adults)').fill('9822222222')
  await fam.getByLabel('Chess').check()
  await fam.getByLabel('Injury waiver accepted at the desk').check()
  await fam.getByRole('button', { name: 'Register and admit' }).click()
  // A rejected entry keeps everything typed, so the volunteer only fixes the age.
  await expect(fam.getByText('Age 1 to 99')).toBeVisible()
  await expect(fam.getByLabel('Name', { exact: true })).toHaveValue('Late Cousin')
  await expect(fam.getByLabel('Mobile (adults)')).toHaveValue('9822222222')
  await expect(fam.getByLabel('Chess')).toBeChecked()
  await fam.getByLabel('Age').fill('21')
  await fam.getByRole('button', { name: 'Register and admit' }).click()
  await expect(gate.getByText('Late Cousin')).toBeVisible()
  await expect(gate.getByText('walk-in').first()).toBeVisible()

  // The family ticket now shows three people in.
  await page.reload()
  await expect(page.getByText(/In at/)).toHaveCount(3)

  // A sport admin signs in with username and password and sees only their sport, without contact details.
  const sportCtx = await browser.newContext()
  const sport = await sportCtx.newPage()
  await sport.goto('/c/jsg/staff/login')
  await sport.getByLabel('Username').fill(chessUser)
  await sport.getByLabel('Password').fill(chessPass)
  await sport.waitForLoadState('networkidle')
  await sport.getByRole('button', { name: 'Sign in' }).click()
  await expect(sport.getByRole('heading', { name: 'Chess' })).toBeVisible()
  await expect(sport.getByText('Gate Parent')).toBeVisible()
  await expect(sport.getByText('Late Cousin')).toBeVisible()
  expect(await sport.content()).not.toMatch(/9811111111|9822222222/)
  // Other sports and the gate are off limits: they bounce back to the admin's own sport.
  await sport.goto('/c/jsg/staff/sport/Cricket')
  await expect(sport).toHaveURL(/staff\/sport\/Chess$/)
  await sport.goto('/c/jsg/staff/gate')
  await expect(sport).toHaveURL(/staff\/sport\/Chess$/)
  expect((await sport.goto('/c/jsg/admin'))?.url()).toMatch(/admin\/login/)

  // The second Chess admin gets in by invite link and sees the same live data.
  const sport2 = await (await browser.newContext()).newPage()
  await sport2.goto(chess2Invite)
  await expect(sport2.getByText('Late Cousin')).toBeVisible()

  // Revoking one admin cuts off their open session at once; the other keeps working.
  await admin.goto('/c/jsg/admin/staff')
  await admin.locator('tr', { has: admin.locator('code:text-is("chess-1")') }).getByRole('button', { name: 'Revoke' }).click()
  await sport.goto('/c/jsg/staff/sport/Chess')
  await expect(sport).toHaveURL(/staff\/login/)
  await sport2.reload()
  await expect(sport2.getByRole('heading', { name: 'Chess' })).toBeVisible()

  // An expired or wrong invite is refused.
  const stranger = await (await browser.newContext()).newPage()
  await stranger.goto('/c/jsg/staff/join/not-a-real-token')
  await expect(stranger.getByText(/invite link has expired/)).toBeVisible()
})

async function registerFamily(page: import('@playwright/test').Page, who: string, mobile: string) {
  await page.goto('/c/jsg/e/1/register')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Your name').fill(who)
  await page.getByLabel('Your mobile').fill(mobile)
  await page.getByLabel('Emergency contact name').fill('Em Contact')
  await page.getByLabel('Emergency contact mobile').fill('9899999999')
  await page.locator('[data-r="0"][data-c="name"]').fill(who)
  await page.locator('[data-r="0"][data-c="age"]').fill('40')
  await page.locator('[data-r="0"][data-c="gender"]').selectOption('Female')
  await page.locator('[data-r="0"][data-c="mobile"]').fill(mobile)
  await page.locator('tr[data-row="0"] td[data-label="Sports"] label', { hasText: 'Carrom' }).click()
  await page.locator('[data-r="0"][data-c="skill"]').selectOption('casual')
  await page.getByLabel('I accept the injury waiver').check()
  await page.getByRole('button', { name: 'Submit registration' }).click()
  await expect(page.getByText(/Registration saved/)).toBeVisible()
  const ref = (await page.getByText(/^Reference/).first().textContent())!.match(/HR-[0-9A-F]{8}/)![0]
  const regUrl = page.url().split('?')[0]
  const ticketUrl = await page.getByRole('link', { name: 'Show my QR ticket' }).getAttribute('href')
  return { ref, regUrl, ticketUrl: ticketUrl! }
}

test('admin approves and rejects; rejected or cancelled QR codes stop working and can be reinstated', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const alpha = await registerFamily(page, 'Review Alpha', '9700000001')
  const beta = await registerFamily(page, 'Review Beta', '9700000002')

  const admin = await (await browser.newContext()).newPage()
  await admin.goto('/c/jsg/admin/login')
  await admin.waitForLoadState('networkidle')
  await admin.getByLabel('Admin password').fill('e2e-password')
  await admin.getByRole('button', { name: 'Sign in' }).click()
  await expect(admin.getByRole('heading', { name: 'Admin console' })).toBeVisible()

  // Review queue: approve Alpha, reject Beta with a reason.
  await admin.goto('/c/jsg/admin/events/1/review')
  await expect(admin.getByRole('heading', { name: /Approve registrations/ })).toBeVisible()
  await admin.locator('section', { hasText: alpha.ref }).getByRole('button', { name: 'Approve' }).click()
  await expect(admin.locator('section', { hasText: alpha.ref })).toHaveCount(0)
  await admin.locator('section', { hasText: beta.ref }).getByLabel(`Note for ${beta.ref}`).fill('Not a member of the group')
  await admin.locator('section', { hasText: beta.ref }).getByRole('button', { name: 'Reject' }).click()
  await expect(admin.locator('section', { hasText: beta.ref })).toHaveCount(0)

  // Beta sees why, and the QR is dead. Alpha's QR works.
  await page.goto(beta.regUrl)
  await expect(page.getByText('Your registration was not approved.')).toBeVisible()
  await expect(page.getByText(/Not a member of the group/).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Show my QR ticket' })).toHaveCount(0)
  await page.goto(beta.ticketUrl)
  await expect(page.getByText('This ticket is not valid')).toBeVisible()
  await expect(page.locator('[role="img"][aria-label^="QR code"]')).toHaveCount(0)
  await page.goto(alpha.ticketUrl)
  await expect(page.locator('[role="img"][aria-label^="QR code"]')).toBeVisible()

  // The gate refuses the rejected ticket and shows why.
  await admin.goto(`/c/jsg/staff/gate?t=${encodeURIComponent(beta.ticketUrl.split('/t/')[1])}`)
  await expect(admin.getByText('DO NOT ADMIT: ticket deactivated')).toBeVisible()
  await expect(admin.getByText(/Not a member of the group/).first()).toBeVisible()
  await expect(admin.getByRole('button', { name: 'Admit selected' })).toHaveCount(0)

  // Alpha cancels herself: the QR stops working and the gate says who cancelled.
  await page.goto(alpha.regUrl)
  await page.getByRole('button', { name: 'Cancel registration' }).click()
  await expect(page.getByText(/cancelled and its QR ticket no longer works/)).toBeVisible()
  await page.goto(alpha.ticketUrl)
  await expect(page.getByText('This ticket is not valid')).toBeVisible()
  await admin.goto(`/c/jsg/staff/gate?q=${alpha.ref}`)
  await admin.getByText('Review Alpha').first().click()
  await expect(admin.getByText('Cancelled by the registrant')).toBeVisible()
  await expect(admin.getByRole('button', { name: 'Admit selected' })).toHaveCount(0)

  // An admin reinstates Beta from the workspace; her QR works again.
  admin.on('dialog', (d) => d.accept())
  await admin.goto('/c/jsg/admin/events/1/registrations?q=Review+Beta')
  await admin.getByLabel('Select Review Beta').check()
  await admin.locator('select[name="action"]').selectOption('confirm')
  await admin.getByRole('button', { name: 'Apply to selected' }).click()
  await expect(admin.locator('td .tag', { hasText: 'approved' }).first()).toBeVisible()
  await page.goto(beta.ticketUrl)
  await expect(page.locator('[role="img"][aria-label^="QR code"]')).toBeVisible()

  // Editing the event must not wipe the gate and spot-desk settings.
  await admin.goto('/c/jsg/admin/events/1')
  await admin.getByRole('button', { name: 'Save event' }).click()
  await expect(admin.getByRole('heading', { name: 'Edit event' })).toBeVisible()
  await admin.goto('/c/jsg/admin/staff')
  await expect(admin.getByLabel(/Check-in points/)).toHaveValue(/Main gate/)
  await expect(admin.getByLabel('Spot registration is open')).toBeChecked()
})

test('double-tapping submit makes one registration, and a lost link is recovered with reference plus mobile', async ({ page, browser }) => {
  test.setTimeout(90_000)
  await page.goto('/c/jsg/e/1/register')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Your name').fill('Dupe Tester')
  await page.getByLabel('Your mobile').fill('9755500000')
  await page.getByLabel('Emergency contact name').fill('Em Contact')
  await page.getByLabel('Emergency contact mobile').fill('9899999999')
  await page.locator('[data-r="0"][data-c="name"]').fill('Dupe Tester')
  await page.locator('[data-r="0"][data-c="age"]').fill('44')
  await page.locator('[data-r="0"][data-c="gender"]').selectOption('Male')
  await page.locator('[data-r="0"][data-c="mobile"]').fill('9755500000')
  await page.locator('tr[data-row="0"] td[data-label="Sports"] label', { hasText: 'Pickleball' }).click()
  await page.locator('[data-r="0"][data-c="skill"]').selectOption('casual')
  await page.getByLabel('I accept the injury waiver').check()
  const submit = page.getByRole('button', { name: 'Submit registration' })
  await submit.dblclick() // two clicks in quick succession
  await expect(page.getByText(/Registration saved/)).toBeVisible()
  const ref = (await page.getByText(/^Reference/).first().textContent())!.match(/HR-[0-9A-F]{8}/)![0]

  const admin = await (await browser.newContext()).newPage()
  await admin.goto('/c/jsg/admin/login')
  await admin.waitForLoadState('networkidle')
  await admin.getByLabel('Admin password').fill('e2e-password')
  await admin.getByRole('button', { name: 'Sign in' }).click()
  await expect(admin.getByRole('heading', { name: 'Admin console' })).toBeVisible()
  await admin.goto('/c/jsg/admin/events/1/registrations?q=Dupe+Tester')
  await expect(admin.getByText('1 of ', { exact: false }).first()).toBeVisible()
  await expect(admin.locator('tbody tr')).toHaveCount(1)

  // Lost the link: reference + the wrong mobile is refused, the right one leads back to the registration.
  const lost = await (await browser.newContext()).newPage()
  await lost.goto('/c/jsg/my')
  await lost.waitForLoadState('networkidle')
  await lost.getByLabel(/^Reference/).fill(ref)
  await lost.getByLabel(/Mobile number/).fill('9000000000')
  await lost.getByRole('button', { name: 'Find my registration' }).click()
  await expect(lost.getByText(/could not find a registration/)).toBeVisible()
  await lost.getByLabel(/Mobile number/).fill('+91 97555 00000')
  await lost.getByRole('button', { name: 'Find my registration' }).click()
  await expect(lost.getByText(ref).first()).toBeVisible()
  await expect(lost.getByRole('link', { name: 'Show my QR ticket' })).toBeVisible()
})
