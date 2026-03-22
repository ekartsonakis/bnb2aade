import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const mockFilingSchema = z.object({
  bookingId: z.string(),
})

// Mock AADE filing for development/testing
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
    const { bookingId } = mockFilingSchema.parse(body)

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

    // Mock successful filing
    const mockResult = {
      success: true,
      message: 'Mock filing successful (development mode)',
      receiptUrl: null,
    }

    // Get AADE account
    const aadeAccount = await prisma.account.findFirst({
      where: { userId: user.id, type: 'aade', isActive: true },
    })

    // Create filing record
    await prisma.filing.create({
      data: {
        userId: user.id,
        bookingId: booking.id,
        aadeAccount: aadeAccount?.identifier || 'mock-aade',
        status: 'success',
        errorMsg: null,
        receiptUrl: null,
      },
    })

    // Update booking status
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: 'filed',
        filedAt: new Date(),
      },
    })

    // Deduct credit
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

    return NextResponse.json(mockResult)
  } catch (error) {
    console.error('Mock filing error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
