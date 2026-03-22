/**
 * Airbnb Selector Discovery - Fixed Selectors
 *
 * Run: AIRBNB_EMAIL=ekartsonakis@gmail.com AIRBNB_PASSWORD='Sabrela43$' npx tsx src/scripts/discover-airbnb-selectors-v2.ts
 */

import { chromium, Browser, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const LOGIN_URL = 'https://www.airbnb.com/login'
const RESERVATIONS_URL = 'https://www.airbnb.com/hosting/reservations'
const SCREENSHOT_DIR = '/home/vagrant/bnb2aade/airbnb-discovery'

const AIRBNB_EMAIL = process.env.AIRBNB_EMAIL || ''
const AIRBNB_PASSWORD = process.env.AIRBNB_PASSWORD || ''

async function screenshot(page: Page, name: string) {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: filepath, fullPage: true })
  console.log(`  Screenshot: ${filepath}`)
}
async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function run() {
  console.log('Airbnb Login Flow Discovery\n')

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  })

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  })

  const page = await context.newPage()
  page.on('console', msg => { if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text()) })

  // ===== STEP 1: Load login page =====
  console.log('[1] Loading login page...')
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(3000)
  await screenshot(page, '01-login-page')

  // Wait for the email/phone input to appear (it's JS-rendered)
  const inputSelector = 'input#phone-or-email'
  let inputFound = false
  try {
    await page.waitForSelector(inputSelector, { timeout: 10000 })
    inputFound = true
    console.log('  Found input#phone-or-email')
  } catch {
    console.log('  input#phone-or-email NOT found after 10s')
    // Dump page state for debugging
    const html = await page.content()
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'debug-no-input.html'), html)
    console.log('  Dumped page HTML for debugging')
  }

  // Check for submit button
  const submitBtn = await page.$('button[type="submit"]')
  console.log(`  Found button[type="submit"]: ${!!submitBtn}`)
  if (submitBtn) {
    const text = await submitBtn.textContent()
    console.log(`  Submit button text: "${text?.trim()}"`)
  }

  // Check form action
  const formAction = await page.$eval('form', f => f.action || 'no action').catch(() => 'no form found')
  console.log(`  Form action: ${formAction}`)

  // ===== STEP 2: Fill email and submit =====
  if (AIRBNB_EMAIL && inputFound) {
    console.log(`\n[2] Filling email: ${AIRBNB_EMAIL}`)
    await page.fill(inputSelector, AIRBNB_EMAIL)
    await screenshot(page, '02-after-fill-email')
    await sleep(500)

    console.log('  Clicking Continue...')
    await page.click('button[type="submit"]')
    await sleep(4000)
    await screenshot(page, '03-after-submit-step1')
    console.log(`  URL: ${page.url()}`)
    console.log(`  Title: ${await page.title()}`)

    // Check for password field
    const pwdSelectors = ['input[name="password"]', 'input[type="password"]', 'input#password']
    let pwdFound = false
    for (const sel of pwdSelectors) {
      const el = await page.$(sel)
      if (el) { console.log(`  Password field found: ${sel}`); pwdFound = true; break }
    }
    if (!pwdFound) console.log('  No password field found')

    // Check for verification code (2FA)
    const codeSelectors = ['input[name="code"]', 'input[placeholder*="code"]', 'input[placeholder*="verification"]']
    for (const sel of codeSelectors) {
      const el = await page.$(sel)
      if (el) { console.log(`  2FA code field found: ${sel}`); break }
    }

    // Dump all inputs on this page
    const inputs = await page.$$eval('input', els =>
      els.map(el => ({ type: el.type, name: el.name, id: el.id, placeholder: el.placeholder, autocomplete: el.autocomplete, inputmode: el.inputMode }))
    )
    console.log('\n  All inputs:')
    inputs.forEach((inp, i) => {
      console.log(`    [${i}] type="${inp.type}" name="${inp.name}" id="${inp.id}" placeholder="${inp.placeholder}" autocomplete="${inp.autocomplete}" inputmode="${inp.inputmode}"`)
    })

    // Check for error alerts
    const errors = await page.$$eval('[class*="error"], [class*="Alert"], [role="alert"]', els =>
      els.map(el => ({ class: el.className.slice(0, 80), text: el.textContent?.trim().slice(0, 100) }))
    )
    if (errors.length > 0) {
      console.log('\n  Errors/alerts:')
      errors.forEach(e => console.log(`    class="${e.class}" text="${e.text}"`))
    }

    // ===== STEP 3: Fill password =====
    if (pwdFound && AIRBNB_PASSWORD) {
      console.log(`\n[3] Filling password...`)
      const pwdField = await page.$('input[name="password"]')!
      await pwdField.fill(AIRBNB_PASSWORD)
      await screenshot(page, '04-after-fill-password')
      await sleep(500)

      console.log('  Clicking submit...')
      await page.click('button[type="submit"]')
      await sleep(6000)
      await screenshot(page, '05-after-login-submit')
      console.log(`  URL: ${page.url()}`)
      console.log(`  Title: ${await page.title()}`)
    }

    // ===== STEP 4: Navigate to reservations =====
    console.log(`\n[4] Navigating to reservations...`)
    await page.goto(RESERVATIONS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await sleep(3000)
    await screenshot(page, '06-reservations-page')
    console.log(`  URL: ${page.url()}`)
    console.log(`  Title: ${await page.title()}`)

    if (!page.url().includes('login')) {
      console.log('\n  SUCCESS - logged in! Exploring reservations page...')

      const cards = await page.$$eval('[data-testid], [class*="reserv"], [class*="booking"], [class*="guest"]', els =>
        els.slice(0, 40).map(el => ({
          dataTestId: el.getAttribute('data-testid'),
          class: String(el.className || '').slice(0, 80),
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100),
        }))
      )
      console.log('\n  Reservation-related elements:')
      cards.forEach((c, i) => {
        if (c.text.length > 5 && (c.class.includes('reserv') || c.class.includes('booking') || c.class.includes('guest') || c.class.includes('stay') || c.dataTestId)) {
          console.log(`    [${i}] data-testid="${c.dataTestId}" class="${c.class}" text="${c.text}"`)
        }
      })

      const headings = await page.$$eval('h1,h2,h3,h4', els =>
        els.map(el => ({ tag: el.tagName, text: el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) }))
      )
      console.log('\n  Headings:')
      headings.forEach(h => console.log(`    ${h.tag}: "${h.text}"`))

    } else {
      console.log('\n  Login failed - still on login page')
    }
  }

  fs.writeFileSync(path.join(SCREENSHOT_DIR, 'final-page.html'), await page.content())
  await browser.close()
  console.log('\nDone. Check ' + SCREENSHOT_DIR + '/ for screenshots and HTML.')
}

run().catch(err => { console.error(err); process.exit(1) })
