import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function GET() {
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

    const bookings = await prisma.booking.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Get bookings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

const bookingSchema = z.object({
  accountId: z.string(),
  source: z.enum(['airbnb', 'booking']),
  sourceId: z.string(),
  guestName: z.string().optional(),
  checkIn: z.string(),
  checkOut: z.string(),
  nights: z.number(),
  amount: z.number(),
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

    const body = await request.json()
    const data = bookingSchema.parse(body)

    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        accountId: data.accountId,
        source: data.source,
        sourceId: data.sourceId,
        guestName: data.guestName,
        checkIn: new Date(data.checkIn),
        checkOut: new Date(data.checkOut),
        nights: data.nights,
        amount: data.amount,
        status: 'pending',
      },
    })

    return NextResponse.json(booking)
  } catch (error) {
    console.error('Create booking error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
