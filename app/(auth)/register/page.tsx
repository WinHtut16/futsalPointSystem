import RegisterForm from '@/components/auth/RegisterForm'
import T from '@/components/ui/T'
import LanguageToggle from '@/components/ui/LanguageToggle'
import Link from 'next/link'

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-800 flex flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <LanguageToggle variant="light" />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-3xl">⚽</span>
          </div>
          <h1 className="text-2xl font-bold text-white"><T k="auth.createHeading" /></h1>
          <p className="text-brand-200 text-sm mt-1"><T k="auth.createTagline" /></p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <RegisterForm />
          <p className="text-center text-sm text-gray-500 mt-4">
            <T k="auth.haveAccount" />{' '}
            <Link href="/login" className="text-brand-600 font-medium hover:underline">
              <T k="auth.signInLink" />
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
