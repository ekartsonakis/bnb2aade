import { chromium, Browser, Page } from 'playwright'

// AADE myTAXISnet portal URLs
const AADE_LOGIN_URL = 'https://www1.gsis.gr/taxisnet/mytaxisnet/user/login.html'
const AADE_SHORT_RENTAL_URL = 'https://www1.gsis.gr/taxisnet/taxisnet/startUpFlow.action;jsessionid=AAAAAAAAAAAAAAAAAAAA?taskId=1125'

interface AADECredentials {
  username: string
  password: string
}

interface FilingResult {
  success: boolean
  message: string
  receiptUrl?: string
}

export class AADEAgent {
  private browser: Browser | null = null
  private page: Page | null = null
  private credentials: AADECredentials

  constructor(credentials: AADECredentials) {
    this.credentials = credentials
  }

  async init() {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    this.page = await this.browser.newPage()
  }

  async login(): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized')

    try {
      await this.page.goto(AADE_LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 })

      // Fill username
      await this.page.fill('#username', this.credentials.username)

      // Fill password
      await this.page.fill('#password', this.credentials.password)

      // Click login button
      await this.page.click('button[type="submit"]')

      // Wait for navigation or error
      await this.page.waitForLoadState('networkidle', { timeout: 30000 })

      // Check for successful login (look for dashboard elements)
      const errorMsg = await this.page.$('.error-message')
      if (errorMsg) {
        const text = await errorMsg.textContent()
        console.error('Login failed:', text)
        return false
      }

      console.log('Successfully logged into AADE')
      return true
    } catch (error) {
      console.error('Login error:', error)
      return false
    }
  }

  async fileDeclaration(booking: {
    guestName: string
    checkIn: Date
    checkOut: Date
    nights: number
    amount: number
    propertyTaxId: string // Αριθμός Μητρώου Ακινήτων (ΑΜΑ)
  }): Promise<FilingResult> {
    if (!this.page) throw new Error('Browser not initialized')

    try {
      // Navigate to short-term rental declaration
      await this.page.goto(AADE_SHORT_RENTAL_URL, { waitUntil: 'networkidle', timeout: 30000 })

      // Fill in the declaration form
      // Note: The exact selectors depend on AADE's current form structure
      // This is a placeholder - we'll need to adjust based on actual AADE UI

      // Property ID (ΑΜΑ)
      await this.page.fill('#ama', booking.propertyTaxId)

      // Check-in date (format: DD/MM/YYYY)
      const checkInStr = this.formatDate(booking.checkIn)
      await this.page.fill('#checkInDate', checkInStr)

      // Check-out date
      const checkOutStr = this.formatDate(booking.checkOut)
      await this.page.fill('#checkOutDate', checkOutStr)

      // Guest name
      await this.page.fill('#guestName', booking.guestName)

      // Rental amount
      await this.page.fill('#rentalAmount', booking.amount.toString())

      // Submit
      await this.page.click('#submitBtn')

      // Wait for confirmation
      await this.page.waitForLoadState('networkidle', { timeout: 30000 })

      // Take screenshot for receipt
      const receiptPath = `/tmp/aade-receipt-${Date.now()}.png`
      await this.page.screenshot({ path: receiptPath, fullPage: true })

      return {
        success: true,
        message: 'Declaration filed successfully',
        receiptUrl: receiptPath
      }
    } catch (error) {
      console.error('Filing error:', error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }
}

// Helper function to file a single booking
export async function fileBooking(
  credentials: AADECredentials,
  booking: {
    guestName: string
    checkIn: Date
    checkOut: Date
    nights: number
    amount: number
    propertyTaxId: string
  }
): Promise<FilingResult> {
  const agent = new AADEAgent(credentials)

  try {
    await agent.init()
    const loggedIn = await agent.login()

    if (!loggedIn) {
      return { success: false, message: 'Failed to login to AADE' }
    }

    return await agent.fileDeclaration(booking)
  } finally {
    await agent.close()
  }
}
