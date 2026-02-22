'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { StepIndicator } from '@/components/onboarding/step-indicator'
import { FamilyStep } from '@/components/onboarding/family-step'
import { RoleAvatarStep } from '@/components/onboarding/role-avatar-step'

type OnboardingStep = 'family-choose' | 'family-join' | 'family-create' | 'role-avatar'

export default function OnboardingPage() {
  const [step, setStep] = useState<OnboardingStep | null>(null)
  // Tracks whether the family step was skipped (user already had family_id on load)
  const [skippedFamilyStep, setSkippedFamilyStep] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    // Only fetch once on mount
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true

    async function fetchProfile() {
      const supabase = supabaseRef.current
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single()

      if (profile?.family_id) {
        setSkippedFamilyStep(true)
        setStep('role-avatar')
      } else {
        setStep('family-choose')
      }
      setLoading(false)
    }

    fetchProfile()
  }, [router])

  function handleFamilyComplete() {
    setStep('role-avatar')
  }

  function handleRoleAvatarComplete() {
    router.push('/quests')
    router.refresh()
  }

  if (loading || !step) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    )
  }

  // If family step was skipped, show only 1 step; otherwise show 2
  const totalSteps = skippedFamilyStep ? 1 : 2
  const currentStepNumber = step === 'role-avatar' ? totalSteps : 1
  const labels = skippedFamilyStep ? ['Role & Avatar'] : ['Family', 'Role & Avatar']

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Welcome!</h1>
          <p className="text-gray-600 mt-1">Let&apos;s get you set up</p>
        </div>

        <div className="mb-8">
          <StepIndicator
            currentStep={currentStepNumber}
            totalSteps={totalSteps}
            labels={labels}
          />
        </div>

        {step === 'role-avatar' ? (
          <RoleAvatarStep onComplete={handleRoleAvatarComplete} />
        ) : (
          <FamilyStep onComplete={handleFamilyComplete} />
        )}
      </div>
    </div>
  )
}
