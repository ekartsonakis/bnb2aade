import ICAL from 'ical.js'

interface ParsedBooking {
  uid: string
  summary: string
  description: string
  start: Date
  end: Date
  location: string
}

export async function fetchICalFeed(url: string): Promise<ParsedBooking[]> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch iCal feed: ${response.statusText}`)
  }

  const icalText = await response.text()
  const jcalData = ICAL.parse(icalText)
  const comp = new ICAL.Component(jcalData)
  const vevents = comp.getAllSubcomponents('vevent')

  const bookings: ParsedBooking[] = []

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent)

    // Only include completed bookings (check-out date has passed)
    const now = new Date()
    if (event.endDate && event.endDate.toJSDate() <= now) {
      bookings.push({
        uid: event.uid || event.summary,
        summary: event.summary || 'Unknown',
        description: event.description || '',
        start: event.startDate.toJSDate(),
        end: event.endDate.toJSDate(),
        location: event.location || '',
      })
    }
  }

  // Sort by check-out date (most recent first)
  bookings.sort((a, b) => b.end.getTime() - a.end.getTime())

  return bookings
}

export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diffTime = checkOut.getTime() - checkIn.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function extractAmountFromDescription(description: string): number {
  // Try to find price in description
  // Common formats: "€100", "100 EUR", "100,00 €"
  const patterns = [
    /€\s*([\d,]+\.?\d*)/,
    /([\d,]+\.?\d*)\s*€/,
    /([\d,]+\.?\d*)\s*EUR/,
    /EUR\s*([\d,]+\.?\d*)/,
  ]

  for (const pattern of patterns) {
    const match = description.match(pattern)
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'))
      if (!isNaN(amount)) {
        return amount
      }
    }
  }

  return 0
}
