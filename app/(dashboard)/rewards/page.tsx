'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import type { Profile } from '@/lib/types'

export default function RewardsPage() {
  const [members, setMembers] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      setLoading(false)
      return
    }
    setCurrentUser(profile)

    if (profile.family_id) {
      const { data: membersData } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', profile.family_id)
        .order('points', { ascending: false })

      setMembers(membersData || [])
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  if (!currentUser?.family_id) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Family Yet</h2>
          <p className="text-gray-600 mb-4">
            Join a family to see the leaderboard!
          </p>
          <a
            href="/family"
            className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            Set Up Family
          </a>
        </div>
      </div>
    )
  }

  const topThree = members.slice(0, 3)
  const rest = members.slice(3)

  return (
    <div className="p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Rewards</h1>
        <p className="text-gray-600">Family leaderboard</p>
      </header>

      {/* Podium for top 3 */}
      {topThree.length > 0 && (
        <div className="flex items-end justify-center gap-2 py-6">
          {/* 2nd place */}
          {topThree[1] && (
            <div className="flex flex-col items-center">
              <Avatar
                src={topThree[1].avatar_url}
                fallback={topThree[1].nickname || topThree[1].display_name}
                size="lg"
              />
              <span className="text-sm font-medium mt-2 text-gray-700">
                {topThree[1].nickname || topThree[1].display_name.split(' ')[0]}
              </span>
              <div className="w-20 h-16 bg-gray-200 rounded-t-lg flex items-center justify-center mt-2">
                <span className="text-2xl">🥈</span>
              </div>
              <span className="text-sm font-bold text-gray-600">{topThree[1].points} pts</span>
            </div>
          )}

          {/* 1st place */}
          {topThree[0] && (
            <div className="flex flex-col items-center -mt-4">
              <div className="relative">
                <Avatar
                  src={topThree[0].avatar_url}
                  fallback={topThree[0].nickname || topThree[0].display_name}
                  size="xl"
                />
                <span className="absolute -top-2 -right-2 text-2xl">👑</span>
              </div>
              <span className="text-sm font-medium mt-2 text-gray-900">
                {topThree[0].nickname || topThree[0].display_name.split(' ')[0]}
              </span>
              <div className="w-24 h-24 bg-yellow-400 rounded-t-lg flex items-center justify-center mt-2">
                <span className="text-3xl">🏆</span>
              </div>
              <span className="text-lg font-bold text-purple-600">{topThree[0].points} pts</span>
            </div>
          )}

          {/* 3rd place */}
          {topThree[2] && (
            <div className="flex flex-col items-center">
              <Avatar
                src={topThree[2].avatar_url}
                fallback={topThree[2].nickname || topThree[2].display_name}
                size="lg"
              />
              <span className="text-sm font-medium mt-2 text-gray-700">
                {topThree[2].nickname || topThree[2].display_name.split(' ')[0]}
              </span>
              <div className="w-20 h-12 bg-orange-300 rounded-t-lg flex items-center justify-center mt-2">
                <span className="text-2xl">🥉</span>
              </div>
              <span className="text-sm font-bold text-gray-600">{topThree[2].points} pts</span>
            </div>
          )}
        </div>
      )}

      {/* Rest of the members */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((member, index) => (
            <Card key={member.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500">
                  {index + 4}
                </span>
                <Avatar
                  src={member.avatar_url}
                  fallback={member.nickname || member.display_name}
                  size="md"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900">
                    {member.nickname || member.display_name}
                  </span>
                </div>
                <span className="font-bold text-purple-600">{member.points} pts</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rewards Section (Stub) */}
      <section className="pt-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Available Rewards</h2>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Coming Soon!</h3>
            <p className="text-gray-600 text-sm">
              Redeem your points for real rewards like screen time, treats, or special activities.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
