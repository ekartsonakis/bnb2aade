import { chromium, Browser, Page } from 'playwright'

interface AirbnbCredentials {
  email: string
  password: string
}

interface GuestDetails {
  fullName: string
  email?: string
  phone?: string
  nationality?: string
  passportNumber?: string
  address?: string
}

interface BookingSearchParams {
  checkIn: Date
  checkOut: Date
  guestName?: string // partial name from iCal to help identify
}

export class AirbnbScraper {
  private browser: Browser | null = null
  private page: Page | null = null
  private credentials: AirbnbCredentials

  constructor(credentials: AirbnbCredentials) {
    this.credentials = credentials
  }

  async init() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    })
    this.page = await this.browser.newPage()
  }

  async login(): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized')

    try {
      // Go to Airbnb login
      await this.page.goto('https://www.airbnb.com/login', { waitUntil: 'networkidle', timeout: 30000 })

      // Enter email
      await this.page.fill('input[name="email"]', this.credentials.email)
      await this.page.click('button[type="submit"]')

      // Wait for password field and enter password
      await this.page.waitForSelector('input[name="password"]', { timeout: 10000 })
      await this.page.fill('input[name="password"]', this.credentials.password)
      await this.page.click('button[type="submit"]')

      // Wait for login to complete
      await this.page.waitForNavigation({ timeout: 15000 }).catch(() => {})

      // Check if logged in (look for user avatar or dashboard)
      const avatar = await this.page.$('img[alt="User avatar"], [data-testid="user-avatar"]')
      return !!avatar
    } catch (error) {
      console.error('Airbnb login error:', error)
      return false
    }
  }

  async getGuestDetailsForBooking(searchParams: BookingSearchParams): Promise<GuestDetails | null> {
    if (!this.page) throw new Error('Browser not initialized')

    try {
      // Go to reservations calendar
      await this.page.goto('https://www.airbnb.com/hosting/reservations', { waitUntil: 'networkidle', timeout: 30000 })

      // Look for reservations around the check-in date
      // Try to find reservation by approximate date
      const checkInStr = this.formatDateShort(searchParams.checkIn)

      // Click on the reservation that matches (or near) the check-in date
      // This is a simplified approach - in reality would need more robust date matching
      const reservationCards = await this.page.$$('[data-testid="reservation-card"]')

      for (const card of reservationCards) {
        const cardText = await card.textContent() || ''

        // Check if this card matches our dates (approximate)
        if (cardText && cardText.includes(checkInStr)) {
          // Click to open reservation details
          await card.click()
          await this.page.waitForTimeout(2000)

          // Extract guest details from the opened modal/page
          const details = await this.extractGuestDetails()
          return details
        }
      }

      console.log('Could not find reservation for date:', checkInStr)
      return null
    } catch (error) {
      console.error('Error getting guest details:', error)
      return null
    }
  }

  private async extractGuestDetails(): Promise<GuestDetails | null> {
    if (!this.page) return null

    try {
      // Try different selectors for guest information
      const details: GuestDetails = {
        fullName: '',
      }

      // Guest name - various possible selectors
      const nameEl = await this.page.$('[data-testid="guest-name"], .guest-name, h2, [class*="guest"]')
      if (nameEl) {
        details.fullName = (await nameEl.textContent())?.trim() || ''
      }

      // Email - usually in a section with guest contact info
      const emailEl = await this.page.$('a[href^="mailto:"], [class*="email"]')
      if (emailEl) {
        const href = await emailEl.getAttribute('href') || await emailEl.textContent()
        if (href?.includes('@')) {
          details.email = href.replace('mailto:', '').trim()
        }
      }

      // Phone
      const phoneEl = await this.page.$('a[href^="tel:"], [class*="phone"]')
      if (phoneEl) {
        const href = await phoneEl.getAttribute('href') || await phoneEl.textContent()
        if (href) {
          details.phone = href.replace('tel:', '').trim()
        }
      }

      // Look for passport/ID in the page
      const bodyText = await this.page.content()
      if (bodyText) {
        // Look for passport number patterns
        const passportMatch = bodyText.match(/passport[:\s]*([A-Z0-9]{6,12})/i)
        if (passportMatch) {
          details.passportNumber = passportMatch[1]
        }

        // Look for nationality
        const nationalityMatch = bodyText.match(/nationality[:\s]*([A-Za-z\s]+)/i)
        if (nationalityMatch) {
          details.nationality = nationalityMatch[1].trim()
        }
      }

      return details.fullName ? details : null
    } catch (error) {
      console.error('Error extracting guest details:', error)
      return null
    }
  }

  private formatDateShort(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${months[date.getMonth()]} ${date.getDate()}`
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }
}

// Helper function to scrape guest details
export async function scrapeAirbnbGuestDetails(
  credentials: AirbnbCredentials,
  searchParams: BookingSearchParams
): Promise<GuestDetails | null> {
  const scraper = new AirbnbScraper(credentials)

  try {
    await scraper.init()
    const loggedIn = await scraper.login()

    if (!loggedIn) {
      console.error('Failed to login to Airbnb')
      return null
    }

    return await scraper.getGuestDetailsForBooking(searchParams)
  } finally {
    await scraper.close()
  }
}