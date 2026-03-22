'use client'

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LogoutButton } from '@/components/LogoutButton'

interface Account {
  id: string
  type: string
  identifier: string
  credentials?: string
  createdAt: string
}

export default function AccountsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    identifier: '',
    username: '',
    password: '',
    icalUrl: '',
  })
  const [newAccount, setNewAccount] = useState({
    type: 'aade',
    identifier: '',
    username: '',
    password: '',
    icalUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [accountDetails, setAccountDetails] = useState<Record<string, { icalUrl?: string }>>({})

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchAccounts()
    }
  }, [status, router])

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts')
      if (res.ok) {
        const data = await res.json()
        setAccounts(data)

        // Fetch details for each account to get iCal URL
        const details: Record<string, { icalUrl?: string }> = {}
        for (const account of data) {
          if (account.type === 'airbnb' || account.type === 'booking') {
            try {
              const detailRes = await fetch(`/api/accounts?id=${account.id}`)
              if (detailRes.ok) {
                const detail = await detailRes.json()
                if (detail.credentials) {
                  const creds = JSON.parse(detail.credentials)
                  details[account.id] = { icalUrl: creds.icalUrl }
                }
              }
            } catch (e) {}
          }
        }
        setAccountDetails(details)
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate iCal URL for Airbnb/Booking
    if ((newAccount.type === 'airbnb' || newAccount.type === 'booking') && !newAccount.icalUrl) {
      setError('iCal URL is required for Airbnb and Booking.com accounts')
      return
    }

    // Validate AADE credentials
    if (newAccount.type === 'aade' && (!newAccount.username || !newAccount.password)) {
      setError('Username and password are required for AADE accounts')
      return
    }

    setSaving(true)

    try {
      let credentials: Record<string, string> = {}

      if (newAccount.type === 'aade') {
        credentials = {
          username: newAccount.username,
          password: newAccount.password,
        }
      } else {
        credentials = {
          icalUrl: newAccount.icalUrl,
        }
      }

      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newAccount.type,
          identifier: newAccount.identifier,
          credentials: JSON.stringify(credentials),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add account')
      }

      setShowAddForm(false)
      setNewAccount({ type: 'aade', identifier: '', username: '', password: '', icalUrl: '' })
      fetchAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this account?')) return

    try {
      const res = await fetch(`/api/accounts?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchAccounts()
      }
    } catch (err) {
      console.error('Failed to delete account:', err)
    }
  }

  const maskUrl = (url: string) => {
    if (!url || url.length < 10) return url
    const visible = url.substring(0, 15)
    const hidden = '*'.repeat(32)
    const end = url.substring(url.length - 10)
    return `${visible}${hidden}${end}`
  }

  const startEdit = (account: Account) => {
    setEditingId(account.id)
    setEditForm({
      identifier: account.identifier,
      username: '',
      password: '',
      icalUrl: '', // Will fetch from API
    })

    // Fetch the full account details to get the iCal URL
    fetch(`/api/accounts?id=${account.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.credentials) {
          const creds = JSON.parse(data.credentials)
          if (creds.icalUrl) {
            setEditForm(prev => ({ ...prev, icalUrl: creds.icalUrl }))
          }
        }
      })
      .catch(err => console.error('Failed to fetch account details:', err))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({ identifier: '', username: '', password: '', icalUrl: '' })
  }

  const handleEdit = async (account: Account) => {
    setSaving(true)
    setError('')

    try {
      let credentials: Record<string, string> = {}

      if (account.type === 'aade') {
        // Only update password if provided
        if (editForm.password) {
          credentials = { password: editForm.password }
        }
      } else {
        credentials = { icalUrl: editForm.icalUrl }
      }

      const res = await fetch('/api/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: account.id,
          identifier: editForm.identifier,
          credentials: Object.keys(credentials).length > 0 ? JSON.stringify(credentials) : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update account')
      }

      cancelEdit()
      fetchAccounts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account')
    } finally {
      setSaving(false)
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
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/dashboard" className="text-blue-600 hover:underline mb-2 block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              Linked Accounts
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Your Accounts
            </h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {showAddForm ? 'Cancel' : '+ Add Account'}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddAccount} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                    Account Type
                  </label>
                  <select
                    value={newAccount.type}
                    onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-600 text-gray-800 dark:text-white"
                  >
                    <option value="aade">AADE (Greek Tax Authority)</option>
                    <option value="airbnb">Airbnb</option>
                    <option value="booking">Booking.com</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                    Identifier (Email/Username)
                  </label>
                  <input
                    type="text"
                    value={newAccount.identifier}
                    onChange={(e) => setNewAccount({ ...newAccount, identifier: e.target.value })}
                    required
                    className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-600 text-gray-800 dark:text-white"
                  />
                </div>

                {newAccount.type === 'aade' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                        Taxisnet Username
                      </label>
                      <input
                        type="text"
                        value={newAccount.username}
                        onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-600 text-gray-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                        Taxisnet Password
                      </label>
                      <input
                        type="password"
                        value={newAccount.password}
                        onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-600 text-gray-800 dark:text-white"
                      />
                    </div>
                  </>
                )}

                {(newAccount.type === 'airbnb' || newAccount.type === 'booking') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                      iCal URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={newAccount.icalUrl}
                      onChange={(e) => setNewAccount({ ...newAccount, icalUrl: e.target.value })}
                      placeholder="https://www.airbnb.com/calendar/ical/XXXXXXX.ics?s=..."
                      className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-600 text-gray-800 dark:text-white"
                    />
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-600 p-3 rounded">
                      <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">To find your iCal URL on Airbnb:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Log in to airbnb.com</li>
                        <li>Go to your listing&apos;s Calendar</li>
                        <li>Click on Availability settings</li>
                        <li>Scroll down to the &quot;Sync calendars&quot; section</li>
                        <li>Copy the link under &quot;Step 1: Add this link to the other website&quot;</li>
                      </ol>
                      <p className="mt-1 text-gray-800 dark:text-gray-200">The URL will look like: <code className="bg-gray-200 dark:bg-gray-500 px-1 rounded">https://www.airbnb.com/calendar/ical/XXXXXXX.ics?s=...</code></p>
                      <p className="mt-1 text-gray-800 dark:text-gray-200">It&apos;s easier to do this from a desktop browser rather than the mobile app.</p>
                    </div>
                  </div>
                )}

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          )}

          {accounts.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">
              No accounts linked yet. Add your AADE, Airbnb, or Booking.com account to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="p-4 border rounded dark:border-gray-600"
                >
                  {editingId === account.id ? (
                    <div className="space-y-3">
                      <p className="font-medium text-gray-800 dark:text-white">
                        Edit {account.type.toUpperCase()}
                      </p>
                      <div>
                        <label className="block text-sm text-gray-800 dark:text-gray-200">
                          Identifier
                        </label>
                        <input
                          type="text"
                          value={editForm.identifier}
                          onChange={(e) => setEditForm({ ...editForm, identifier: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-600 text-gray-800 dark:text-white"
                        />
                      </div>
                      {account.type === 'aade' && (
                        <div>
                          <label className="block text-sm text-gray-800 dark:text-gray-200">
                            New Password (leave blank to keep current)
                          </label>
                          <input
                            type="password"
                            value={editForm.password}
                            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-600 text-gray-800 dark:text-white"
                          />
                        </div>
                      )}
                      {(account.type === 'airbnb' || account.type === 'booking') && (
                        <div>
                          <label className="block text-sm text-gray-800 dark:text-gray-200">
                            iCal URL
                          </label>
                          <input
                            type="url"
                            value={editForm.icalUrl}
                            onChange={(e) => setEditForm({ ...editForm, icalUrl: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border rounded-md dark:bg-gray-600 text-gray-800 dark:text-white"
                          />
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-600 p-3 rounded">
                            <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">To find your iCal URL on Airbnb:</p>
                            <ol className="list-decimal list-inside space-y-1">
                              <li>Log in to airbnb.com</li>
                              <li>Go to your listing&apos;s Calendar</li>
                              <li>Click on Availability settings</li>
                              <li>Scroll down to the &quot;Sync calendars&quot; section</li>
                              <li>Copy the link under &quot;Step 1: Add this link to the other website&quot;</li>
                            </ol>
                            <p className="mt-1 text-gray-800 dark:text-gray-200">The URL will look like: <code className="bg-gray-200 dark:bg-gray-500 px-1 rounded">https://www.airbnb.com/calendar/ical/XXXXXXX.ics?s=...</code></p>
                          </div>
                        </div>
                      )}
                      {error && <p className="text-red-500 text-sm">{error}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(account)}
                          disabled={saving}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white">
                          {account.type.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {account.identifier}
                        </p>
                        {(account.type === 'airbnb' || account.type === 'booking') && accountDetails[account.id]?.icalUrl && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                            iCal: {maskUrl(accountDetails[account.id]?.icalUrl || '')}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          Added {new Date(account.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => startEdit(account)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
