import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const accountSchema = z.object({
  type: z.enum(['airbnb', 'booking', 'aade']),
  identifier: z.string(),
  credentials: z.string(), // JSON string
})

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('id')

    // If ID provided, return single account with credentials
    if (accountId) {
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: user.id, isActive: true },
      })

      if (!account) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 })
      }

      return NextResponse.json({
        id: account.id,
        type: account.type,
        identifier: account.identifier,
        credentials: account.credentials,
        createdAt: account.createdAt,
      })
    }

    // Otherwise return all accounts (without credentials)
    const accounts = await prisma.account.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        id: true,
        type: true,
        identifier: true,
        createdAt: true,
      },
    })

    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Get accounts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    const { type, identifier, credentials } = accountSchema.parse(body)

    // Check if account already exists
    const existing = await prisma.account.findFirst({
      where: {
        userId: user.id,
        type,
        identifier,
        isActive: true,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Account already linked' },
        { status: 400 }
      )
    }

    // Create account
    const account = await prisma.account.create({
      data: {
        userId: user.id,
        type,
        identifier,
        credentials,
      },
    })

    return NextResponse.json({
      id: account.id,
      type: account.type,
      identifier: account.identifier,
    })
  } catch (error) {
    console.error('Add account error:', error)
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

export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('id')

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID required' },
        { status: 400 }
      )
    }

    // Soft delete - mark as inactive
    await prisma.account.updateMany({
      where: {
        id: accountId,
        userId: user.id,
      },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
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
    const { id, identifier, credentials } = body

    if (!id) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.account.findFirst({
      where: { id, userId: user.id, isActive: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Update account
    const updateData: { identifier?: string; credentials?: string } = {}
    if (identifier) updateData.identifier = identifier
    if (credentials) updateData.credentials = credentials

    await prisma.account.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update account error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
