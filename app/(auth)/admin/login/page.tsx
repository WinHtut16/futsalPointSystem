import { Suspense } from 'react'
import Image from 'next/image'
import AdminLoginForm from '@/components/auth/AdminLoginForm'
import LanguageToggle from '@/components/ui/LanguageToggle'
import T from '@/components/ui/T'

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle variant="dark" />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            <Image src="/logo_black.jpg" alt="Mya Thida Futsal" width={928} height={844} className="w-28 h-28 rounded-2xl object-contain shadow-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-white">Mya Thida</h1>
          <p className="text-gray-400 text-sm mt-1">
            <T k="auth.adminPortalTagline" />
          </p>
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
