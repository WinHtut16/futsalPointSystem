'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import TempPasswordModal from '@/components/admin/TempPasswordModal'
import DeleteCustomerButton from '@/components/admin/DeleteCustomerButton'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface Props {
  customerId: string
  customerName: string
  customerPhone: string
}

export default function CustomerDetailActions({ customerId, customerName, customerPhone }: Props) {
  const { t } = useLanguage()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <h2 className="font-semibold text-gray-900 text-sm">Account Actions</h2>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-left"
          >
            <KeyRound className="w-4 h-4 text-gray-400 shrink-0" />
            {t('admin.resetPassword')}
          </button>
          <div className="pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2 mt-1">
              {t('admin.dangerZone')}
            </p>
            <DeleteCustomerButton
              customerId={customerId}
              customerName={customerName}
              customerPhone={customerPhone}
            />
          </div>
        </div>
      </div>

      <TempPasswordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        customerId={customerId}
        customerName={customerName}
        customerPhone={customerPhone}
      />
    </>
  )
}
