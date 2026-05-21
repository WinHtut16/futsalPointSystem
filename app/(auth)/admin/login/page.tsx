import { Suspense } from 'react'
import AdminLoginForm from '@/components/auth/AdminLoginForm'

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-2xl font-bold text-white">AkoATP Admin</h1>
          <p className="text-gray-400 text-sm mt-1">Staff portal</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <Suspense>
            <AdminLoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
