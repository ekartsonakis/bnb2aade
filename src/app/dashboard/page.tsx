import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { LogoutButton } from '@/components/LogoutButton'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function Dashboard() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Account</h2>
          <p className="mb-2 text-gray-800 dark:text-white">
            <span className="font-medium">Email:</span> {user.email}
          </p>
          <p className="mb-2 text-gray-800 dark:text-white">
            <span className="font-medium">Credits:</span> {user.credits}
          </p>
          <p className="mb-2 text-gray-800 dark:text-white">
            <span className="font-medium">Plan:</span>{' '}
            {user.isPremium ? 'Premium' : 'Free'}
          </p>
          <p className="text-gray-800 dark:text-white">
            <span className="font-medium">Status:</span>{' '}
            {user.isPaused ? 'Paused' : 'Active'}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Linked Accounts</h3>
            <p className="text-gray-800 dark:text-gray-300 mb-4">
              Connect your Airbnb, Booking.com, and AADE accounts
            </p>
            <Link
              href="/dashboard/accounts"
              className="text-blue-600 hover:underline"
            >
              Manage Accounts →
            </Link>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Bookings</h3>
            <p className="text-gray-800 dark:text-gray-300 mb-4">
              View and file your Airbnb/Booking.com bookings
            </p>
            <Link
              href="/dashboard/bookings"
              className="text-blue-600 hover:underline"
            >
              View Bookings →
            </Link>
          </div>
        </div>

        {!user.isPremium && (
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Upgrade to Premium</h3>
            <p className="text-gray-800 dark:text-gray-300 mb-4">
              Connect multiple Airbnb/Booking accounts to different AADE
              accounts for €10/month
            </p>
            <Link
              href="/dashboard/upgrade"
              className="text-blue-600 hover:underline font-medium"
            >
              Upgrade Now →
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
