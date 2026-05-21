import { Suspense } from 'react'
import AdminLoginForm from '@/components/auth/AdminLoginForm'

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_black.jpg" alt="Mya Thida" className="w-28 h-28 rounded-2xl object-contain shadow-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-white">Mya Thida</h1>
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
