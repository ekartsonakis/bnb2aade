import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fileBooking } from '@/lib/aade-agent'
import { z } from 'zod'

const filingSchema = z.object({
  bookingId: z.string(),
})

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

    // Check credits
    if (user.credits < 1) {
      return NextResponse.json(
        { error: 'Insufficient credits' },
        { status: 400 }
      )
    }

    // Check if user is paused
    if (user.isPaused) {
      return NextResponse.json(
        { error: 'Service is paused' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { bookingId } = filingSchema.parse(body)

    // Get booking
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, userId: user.id },
    })

    if (!booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Check if already filed
    if (booking.status === 'filed') {
      return NextResponse.json(
        { error: 'Booking already filed' },
        { status: 400 }
      )
    }

    // Get user's AADE credentials
    const aadeAccount = await prisma.account.findFirst({
      where: { userId: user.id, type: 'aade', isActive: true },
    })

    if (!aadeAccount) {
      return NextResponse.json(
        { error: 'No AADE account linked' },
        { status: 400 }
      )
    }

    // Parse credentials (in production, decrypt this)
    const credentials = JSON.parse(aadeAccount.credentials)

    // File the declaration
    const result = await fileBooking(credentials, {
      guestName: booking.guestName || 'Unknown',
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights: booking.nights,
      amount: booking.amount,
      propertyTaxId: '123456789', // TODO: Get from user's property registration
    })

    // Create filing record
    await prisma.filing.create({
      data: {
        userId: user.id,
        bookingId: booking.id,
        aadeAccount: aadeAccount.identifier,
        status: result.success ? 'success' : 'error',
        errorMsg: result.success ? null : result.message,
        receiptUrl: result.receiptUrl || null,
      },
    })

    // Update booking status
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: result.success ? 'filed' : 'error',
        filedAt: result.success ? new Date() : null,
      },
    })

    // Deduct credit on success
    if (result.success) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          credits: { decrement: 1 },
        },
      })

      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -1,
          type: 'usage',
          description: `Filing for booking ${booking.id}`,
        },
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Filing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
