import LoginForm from '@/components/auth/LoginForm'
import T from '@/components/ui/T'
import LanguageToggle from '@/components/ui/LanguageToggle'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-800 flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle variant="light" />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_black.jpg" alt="Mya Thida" className="w-28 h-28 rounded-2xl object-contain shadow-2xl" />
          </div>
          <h1 className="text-2xl font-bold text-white">Mya Thida</h1>
          <p className="text-brand-200 text-sm mt-1"><T k="auth.tagline" /></p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
