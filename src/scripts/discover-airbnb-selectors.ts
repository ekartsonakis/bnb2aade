/**
 * Airbnb Selector Discovery Script (Headless with Screenshots)
 *
 * Run: npx tsx src/scripts/discover-airbnb-selectors.ts
 *
 * This script runs headlessly and takes screenshots at each step
 * so we can inspect the page state and find real selectors.
 */

import { chromium, Browser, Page } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const AIRBNB_URL = 'https://www.airbnb.com'
const LOGIN_URL = `${AIRBNB_URL}/login`
const RESERVATIONS_URL = `${AIRBNB_URL}/hosting/reservations`
const SCREENSHOT_DIR = '/home/vagrant/bnb2aade/airbnb-discovery'

const AIRBNB_EMAIL = process.env.AIRBNB_EMAIL || ''
const AIRBNB_PASSWORD = process.env.AIRBNB_PASSWORD || ''

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

async function screenshot(page: Page, name: string) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`)
  await page.screenshot({ path: filepath, fullPage: true })
  console.log(`  Screenshot saved: ${filepath}`)
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function run() {
  console.log('='.repeat(60))
  console.log('Airbnb Selector Discovery (Headless)')
  console.log('='.repeat(60))

  if (!AIRBNB_EMAIL || !AIRBNB_PASSWORD) {
    console.log('\nWARNING: AIRBNB_EMAIL and AIRBNB_PASSWORD env vars not set.')
    console.log('Set them with: AIRBNB_EMAIL=you@example.com AIRBNB_PASSWORD=xxx npx tsx src/scripts/discover-airbnb-selectors.ts')
  }

  ensureDir(SCREENSHOT_DIR)

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
    ],
  })

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
  })

  const page = await context.newPage()

  let step = 1

  // ===== STEP 1: Login Page =====
  console.log(`\n[Step ${step++}] Loading login page...`)
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(3000)
  await screenshot(page, '01-login-page-loaded')

  // Capture all inputs
  const inputs = await page.$$eval('input', els =>
    els.map(el => ({
      tag: el.tagName,
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      class: el.className,
      ariaLabel: el.getAttribute('aria-label'),
      autocomplete: el.getAttribute('autocomplete'),
      dataTestId: el.getAttribute('data-testid'),
    }))
  )
  console.log('\nInputs found:')
  inputs.forEach((inp, i) => {
    console.log(`  [${i}] type="${inp.type}" name="${inp.name}" placeholder="${inp.placeholder}" class="${inp.class.slice(0, 60)}" ariaLabel="${inp.ariaLabel}"`)
  })

  // Capture all buttons
  const buttons = await page.$$eval('button', els =>
    els.map(el => ({
      type: el.type,
      text: el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60),
      class: el.className,
      dataTestId: el.getAttribute('data-testid'),
      ariaLabel: el.getAttribute('aria-label'),
    }))
  )
  console.log('\nButtons found:')
  buttons.forEach((btn, i) => {
    console.log(`  [${i}] text="${btn.text}" type="${btn.type}" dataTestId="${btn.dataTestId}" ariaLabel="${btn.ariaLabel}"`)
  })

  // Try to identify the login form structure
  const forms = await page.$$eval('form', forms =>
    forms.map(f => ({
      action: f.action,
      id: f.id,
      class: f.className,
      inputs: Array.from(f.querySelectorAll('input')).map(i => ({
        name: i.name,
        type: i.type,
        placeholder: i.placeholder,
      })),
      buttons: Array.from(f.querySelectorAll('button')).map(b => ({
        type: b.type,
        text: b.textContent?.trim().slice(0, 40),
      })),
    }))
  )
  console.log('\nForms found:', JSON.stringify(forms, null, 2))

  // ===== STEP 2: Try logging in if credentials provided =====
  if (AIRBNB_EMAIL && AIRBNB_PASSWORD) {
    console.log(`\n[Step ${step++}] Attempting login...`)

    // First, click "Continue with email" to switch from phone to email input
    const emailTabBtn = await page.$('button[data-testid="social-auth-button-email"]')
    if (emailTabBtn) {
      await emailTabBtn.click()
      console.log('  Clicked "Continue with email"')
      await sleep(2000)
      await screenshot(page, '02-email-tab')
    }

    // Now try to fill email
    const emailInput = await page.$('input[name="email"], input[name="username"], input[type="email"], input[id="email"]')
    if (emailInput) {
      await emailInput.fill(AIRBNB_EMAIL)
      console.log('  Filled email field')
      await screenshot(page, '03-after-email')
    } else {
      console.log('  ERROR: Could not find email input!')
    }

    // Click continue/submit
    const continueBtn = await page.$('button[type="submit"], button:has-text("Continue"), button:has-text("Log in"), button:has-text("Next")')
    if (continueBtn) {
      await continueBtn.click()
      console.log('  Clicked continue')
      await sleep(3000)
      await screenshot(page, '03-after-continue')
    }

    // Now fill password
    const passwordInput = await page.$('input[name="password"], input[type="password"]')
    if (passwordInput) {
      await passwordInput.fill(AIRBNB_PASSWORD)
      console.log('  Filled password field')
      await screenshot(page, '04-after-password')
    } else {
      console.log('  WARNING: Password field not found (may need to click something first)')
    }

    // Submit password
    const submitBtn = await page.$('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Continue")')
    if (submitBtn) {
      await submitBtn.click()
      console.log('  Clicked submit')
      await sleep(5000)
      await screenshot(page, '05-after-login-submit')
    }

    console.log('  Current URL:', page.url())
    console.log('  Page title:', await page.title())

  } else {
    console.log('\n[Step 2] Skipping login - no credentials provided')
  }

  // ===== STEP 3: Navigate to reservations =====
  console.log(`\n[Step ${step++}] Navigating to reservations...`)
  await page.goto(RESERVATIONS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await sleep(3000)
  await screenshot(page, '06-reservations-page')

  const currentUrl = page.url()
  console.log('  Current URL:', currentUrl)

  if (currentUrl.includes('login')) {
    console.log('  Redirected to login - cannot access reservations without auth')
  } else {
    // Capture reservation cards
    const cards = await page.$$eval('[data-testid], [class*="reservation"], [class*="booking"], [class*="stay"]', els =>
      els.slice(0, 20).map(el => ({
        tag: el.tagName,
        dataTestId: el.getAttribute('data-testid'),
        class: el.className,
        text: el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 100),
      }))
    )
    console.log('\nElements with relevant classes:')
    cards.forEach((el, i) => {
      if (el.class && (el.class.includes('reservation') || el.class.includes('booking') || el.class.includes('stay') || el.class.includes('guest'))) {
        console.log(`  [${i}] data-testid="${el.dataTestId}" class="${el.class.slice(0, 80)}" text="${el.text.slice(0, 80)}"`)
      }
    })

    // Get all h1, h2, h3, h4 headings
    const headings = await page.$$eval('h1, h2, h3, h4', els =>
      els.map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80),
        class: el.className,
      }))
    )
    console.log('\nHeadings found:')
    headings.forEach(h => {
      console.log(`  ${h.tag}: "${h.text}"`)
    })

    // Get links that might be reservations
    const links = await page.$$eval('a[href*="reservation"], a[href*="booking"], a[href*="trips"]', els =>
      els.map(el => ({
        href: el.getAttribute('href'),
        text: el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80),
        class: el.className,
      }))
    )
    console.log('\nRelevant links found:', links.length)
    links.slice(0, 10).forEach(l => {
      console.log(`  href="${l.href}" text="${l.text}"`)
    })
  }

  // ===== STEP 4: Dump full page structure =====
  console.log(`\n[Step ${step++}] Dumping page structure...`)
  const fullHtml = await page.content()
  const htmlPath = path.join(SCREENSHOT_DIR, 'page-structure.html')
  fs.writeFileSync(htmlPath, fullHtml)
  console.log(`  Full HTML saved to: ${htmlPath}`)

  // Also save simplified DOM dump
  const domDump = await page.$$eval('*', els =>
    els
      .filter(el => el.children.length === 0 || el.tagName === 'SECTION' || el.tagName === 'DIV')
      .slice(0, 200)
      .map(el => ({
        tag: el.tagName,
        id: el.id,
        class: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
        dataTestId: el.getAttribute('data-testid'),
        text: el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60),
      }))
  )
  const dumpPath = path.join(SCREENSHOT_DIR, 'dom-dump.json')
  fs.writeFileSync(dumpPath, JSON.stringify(domDump, null, 2))
  console.log(`  DOM dump saved to: ${dumpPath}`)

  await browser.close()

  console.log('\n' + '='.repeat(60))
  console.log('Discovery complete! Check:')
  console.log(`  Screenshots: ${SCREENSHOT_DIR}/*.png`)
  console.log(`  Full HTML: ${htmlPath}`)
  console.log(`  DOM dump: ${dumpPath}`)
  console.log('='.repeat(60))
}

run().catch(err => {
  console.error('Script failed:', err)
  process.exit(1)
})
