import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchICalFeed, calculateNights } from '@/lib/ical-service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all active Airbnb/Booking accounts with iCal URLs
    const accounts = await prisma.account.findMany({
      where: {
        userId: user.id,
        isActive: true,
        type: { in: ['airbnb', 'booking'] },
      },
    })

    let totalNewBookings = 0
    const results: { accountId: string; source: string; newBookings: number; error?: string }[] = []

    for (const account of accounts) {
      try {
        // Parse credentials to get iCal URL
        const creds = JSON.parse(account.credentials)
        const icalUrl = creds.icalUrl

        if (!icalUrl) {
          results.push({
            accountId: account.id,
            source: account.type,
            newBookings: 0,
            error: 'No iCal URL configured',
          })
          continue
        }

        // Fetch and parse iCal
        const bookings = await fetchICalFeed(icalUrl)
        let newCount = 0

        for (const booking of bookings) {
          // Check if already exists
          const existing = await prisma.booking.findFirst({
            where: {
              userId: user.id,
              accountId: account.id,
              sourceId: booking.uid,
            },
          })

          if (!existing) {
            const nights = calculateNights(booking.start, booking.end)

            await prisma.booking.create({
              data: {
                userId: user.id,
                accountId: account.id,
                source: account.type,
                sourceId: booking.uid,
                guestName: booking.summary,
                checkIn: booking.start,
                checkOut: booking.end,
                nights,
                amount: 0, // Will need to extract from description or set manually
                status: 'pending',
              },
            })
            newCount++
          }
        }

        totalNewBookings += newCount
        results.push({
          accountId: account.id,
          source: account.type,
          newBookings: newCount,
        })
      } catch (error) {
        results.push({
          accountId: account.id,
          source: account.type,
          newBookings: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      totalNewBookings,
      results,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
