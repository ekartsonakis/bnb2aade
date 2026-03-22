'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LogoutButton } from '@/components/LogoutButton'

interface Booking {
  id: string
  source: string
  sourceId: string
  guestName: string | null
  checkIn: string
  checkOut: string
  nights: number
  amount: number
  status: string
  filedAt: string | null
}

export default function BookingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filing, setFiling] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchBookings()
    }
  }, [status, router])

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/bookings')
      if (res.ok) {
        const data = await res.json()
        setBookings(data)
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFile = async (bookingId: string) => {
    setFiling(bookingId)
    try {
      const res = await fetch('/api/filings/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      })

      if (res.ok) {
        fetchBookings()
      } else {
        const data = await res.json()
        alert(data.error || 'Filing failed')
      }
    } catch (err) {
      console.error('Filing error:', err)
    } finally {
      setFiling(null)
    }
  }

  // Generate test bookings for demo
  const generateTestBookings = async () => {
    const accountsRes = await fetch('/api/accounts')
    const accounts = await accountsRes.json()

    if (accounts.length === 0) {
      alert('Please add an AADE account first')
      return
    }

    // Create test bookings
    const testBookings = [
      {
        accountId: accounts[0].id,
        source: 'airbnb',
        sourceId: 'AIR-12345',
        guestName: 'John Smith',
        checkIn: '2026-03-01',
        checkOut: '2026-03-05',
        nights: 4,
        amount: 400,
      },
      {
        accountId: accounts[0].id,
        source: 'airbnb',
        sourceId: 'AIR-12346',
        guestName: 'Maria Johnson',
        checkIn: '2026-03-10',
        checkOut: '2026-03-14',
        nights: 4,
        amount: 350,
      },
    ]

    for (const booking of testBookings) {
      await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking),
      })
    }

    fetchBookings()
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        alert(`Synced ${data.totalNewBookings} new bookings`)
        fetchBookings()
      } else {
        const data = await res.json()
        alert(data.error || 'Sync failed')
      }
    } catch (err) {
      console.error('Sync error:', err)
    } finally {
      setSyncing(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <main className="min-h-screen p-8 flex items-center justify-center">
        <p className="text-gray-800 dark:text-white">Loading...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/dashboard" className="text-blue-600 hover:underline mb-2 block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              Bookings
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Your Bookings
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : '🔄 Sync from iCal'}
              </button>
              <button
                onClick={generateTestBookings}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                + Test Bookings
              </button>
            </div>
          </div>

          {bookings.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">
              No bookings yet. Add test bookings to try the filing process.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-gray-600">
                    <th className="text-left py-3 px-2 text-gray-800 dark:text-white">Source</th>
                    <th className="text-left py-3 px-2 text-gray-800 dark:text-white">Guest</th>
                    <th className="text-left py-3 px-2 text-gray-800 dark:text-white">Check-in</th>
                    <th className="text-left py-3 px-2 text-gray-800 dark:text-white">Check-out</th>
                    <th className="text-left py-3 px-2 text-gray-800 dark:text-white">Nights</th>
                    <th className="text-left py-3 px-2 text-gray-800 dark:text-white">Amount</th>
                    <th className="text-left py-3 px-2 text-gray-800 dark:text-white">Status</th>
                    <th className="text-left py-3 px-2 text-gray-800 dark:text-white">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id} className="border-b dark:border-gray-700">
                      <td className="py-3 px-2 text-gray-800 dark:text-white">
                        {booking.source === 'airbnb' ? '🏠 Airbnb' : '🏨 Booking'}
                      </td>
                      <td className="py-3 px-2 text-gray-800 dark:text-white">
                        {booking.guestName || '-'}
                      </td>
                      <td className="py-3 px-2 text-gray-800 dark:text-white">
                        {new Date(booking.checkIn).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 text-gray-800 dark:text-white">
                        {new Date(booking.checkOut).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-2 text-gray-800 dark:text-white">
                        {booking.nights}
                      </td>
                      <td className="py-3 px-2 text-gray-800 dark:text-white">
                        €{booking.amount}
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded text-sm ${
                          booking.status === 'filed'
                            ? 'bg-green-100 text-green-800'
                            : booking.status === 'error'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        {booking.status === 'pending' && (
                          <button
                            onClick={() => handleFile(booking.id)}
                            disabled={filing === booking.id}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                          >
                            {filing === booking.id ? 'Filing...' : 'File'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
