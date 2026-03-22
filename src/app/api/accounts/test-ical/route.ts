import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { fetchICalFeed } from '@/lib/ical-service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { icalUrl } = body

    if (!icalUrl) {
      return NextResponse.json({ error: 'iCal URL required' }, { status: 400 })
    }

    try {
      const bookings = await fetchICalFeed(icalUrl)
      return NextResponse.json({
        success: true,
        message: `Valid! Found ${bookings.length} bookings (completed)`,
        bookingsCount: bookings.length,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch iCal feed'
      return NextResponse.json({
        success: false,
        message: message,
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Test iCal error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
