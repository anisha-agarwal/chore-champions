'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { RewardStore } from '@/components/rewards/reward-store'
import { RedemptionHistory } from '@/components/rewards/redemption-history'
import { ManageRewards } from '@/components/rewards/manage-rewards'
import { ApprovalQueue } from '@/components/rewards/approval-queue'
import { RewardForm } from '@/components/rewards/reward-form'
import type { RewardFormData } from '@/components/rewards/reward-form'
import type {
  Profile,
  Reward,
  RewardRedemptionWithDetails,
} from '@/lib/types'

type Tab = 'store' | 'my-rewards' | 'manage' | 'approvals'

const PAGE_SIZE = 20

function RewardsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = (searchParams.get('tab') as Tab) || 'store'

  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [rewards, setRewards] = useState<Reward[]>([])
  const [myRedemptions, setMyRedemptions] = useState<RewardRedemptionWithDetails[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<RewardRedemptionWithDetails[]>([])
  const [hasMoreRedemptions, setHasMoreRedemptions] = useState(false)
  const [redemptionOffset, setRedemptionOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pendingPointsCost, setPendingPointsCost] = useState(0)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)

  const supabase = createClient()

  const fetchMembers = useCallback(
    async (familyId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('family_id', familyId)
        .order('points', { ascending: false })
      setMembers(data ?? [])
    },
    [supabase]
  )

  const fetchRewards = useCallback(
    async (familyId: string) => {
      const { data } = await supabase
        .from('rewards')
        .select('*')
        .eq('family_id', familyId)
        .order('points_cost')
      setRewards(data ?? [])
    },
    [supabase]
  )

  const fetchMyRedemptions = useCallback(
    async (userId: string, offset: number) => {
      const { data, count } = await supabase
        .from('reward_redemptions')
        .select('*, rewards(title, icon_id)', { count: 'exact' })
        .eq('redeemed_by', userId)
        .order('redeemed_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      return { data: (data ?? []) as RewardRedemptionWithDetails[], count: count ?? 0 }
    },
    [supabase]
  )

  const fetchPendingApprovals = useCallback(
    async (familyId: string) => {
      const { data } = await supabase
        .from('reward_redemptions')
        .select(
          '*, rewards!inner(title, icon_id, family_id), profiles!reward_redemptions_redeemed_by_fkey(display_name, nickname, avatar_url)'
        )
        .eq('rewards.family_id', familyId)
        .eq('status', 'pending')
        .order('redeemed_at')
      setPendingApprovals((data ?? []) as RewardRedemptionWithDetails[])
    },
    [supabase]
  )

  const fetchPendingPointsCost = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('reward_redemptions')
        .select('points_cost')
        .eq('redeemed_by', userId)
        .eq('status', 'pending')
      const total = (data ?? []).reduce((sum, r) => sum + r.points_cost, 0)
      setPendingPointsCost(total)
    },
    [supabase]
  )

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (data) setCurrentUser(data)
      return data
    },
    [supabase]
  )

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const profile = await fetchProfile(user.id)
      if (!profile) {
        setLoading(false)
        return
      }

      if (profile.family_id) {
        const isParent = profile.role === 'parent'
        const [redemptionsResult] = await Promise.all([
          fetchMyRedemptions(user.id, 0),
          fetchMembers(profile.family_id),
          fetchRewards(profile.family_id),
          fetchPendingPointsCost(user.id),
          isParent ? fetchPendingApprovals(profile.family_id) : Promise.resolve(undefined),
        ])
        const { data: redemptions, count } = redemptionsResult
        setMyRedemptions(redemptions)
        setHasMoreRedemptions(count > PAGE_SIZE)
        setRedemptionOffset(PAGE_SIZE)
      }

      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    load()
  }, [fetchMembers, fetchMyRedemptions, fetchPendingApprovals, fetchPendingPointsCost, fetchProfile, fetchRewards, supabase])

  const refreshAll = useCallback(
    async (userId: string, familyId: string, isParent: boolean) => {
      const [redemptionsResult] = await Promise.all([
        fetchMyRedemptions(userId, 0),
        fetchProfile(userId),
        fetchRewards(familyId),
        fetchPendingPointsCost(userId),
        isParent ? fetchPendingApprovals(familyId) : Promise.resolve(undefined),
      ])
      const { data: redemptions, count } = redemptionsResult
      setMyRedemptions(redemptions)
      setHasMoreRedemptions(count > PAGE_SIZE)
      setRedemptionOffset(PAGE_SIZE)
    },
    [fetchMyRedemptions, fetchPendingApprovals, fetchPendingPointsCost, fetchProfile, fetchRewards]
  )

  const handleRedeem = async (rewardId: string) => {
    const result = await supabase.rpc('redeem_reward', {
      p_user_id: currentUser!.id,
      p_reward_id: rewardId,
    })
    const data = result.data as { success: boolean; error?: string } | null
    if (!data?.success) {
      throw new Error(data?.error ?? 'Something went wrong')
    }
    await refreshAll(currentUser!.id, currentUser!.family_id!, false)
  }

  const handleApprove = async (redemptionId: string) => {
    const result = await supabase.rpc('resolve_redemption', {
      p_user_id: currentUser!.id,
      p_redemption_id: redemptionId,
      p_action: 'approved',
    })
    const data = result.data as { success: boolean; error?: string } | null
    if (!data?.success) {
      toast.error(data?.error ?? 'Something went wrong')
      return
    }
    await refreshAll(currentUser!.id, currentUser!.family_id!, true)
  }

  const handleReject = async (redemptionId: string) => {
    const result = await supabase.rpc('resolve_redemption', {
      p_user_id: currentUser!.id,
      p_redemption_id: redemptionId,
      p_action: 'rejected',
    })
    const data = result.data as { success: boolean; error?: string } | null
    if (!data?.success) {
      toast.error(data?.error ?? 'Something went wrong')
      return
    }
    await refreshAll(currentUser!.id, currentUser!.family_id!, true)
  }

  const handleCreateReward = async (formData: RewardFormData) => {
    const { error } = await supabase.from('rewards').insert({
      family_id: currentUser!.family_id!,
      title: formData.title,
      description: formData.description || null,
      points_cost: formData.points_cost,
      icon_id: formData.icon_id,
      category: formData.category,
      stock: formData.stock,
      created_by: currentUser!.id,
    })
    if (error) throw new Error(error.message)
    await fetchRewards(currentUser!.family_id!)
  }

  const handleUpdateReward = async (formData: RewardFormData) => {
    const { error } = await supabase
      .from('rewards')
      .update({
        title: formData.title,
        description: formData.description || null,
        points_cost: formData.points_cost,
        icon_id: formData.icon_id,
        category: formData.category,
        stock: formData.stock,
      })
      .eq('id', editingReward!.id)
    if (error) throw new Error(error.message)
    await fetchRewards(currentUser!.family_id!)
  }

  const handleToggleActive = async (reward: Reward) => {
    const { error } = await supabase
      .from('rewards')
      .update({ active: !reward.active })
      .eq('id', reward.id)
    if (error) {
      toast.error(error.message)
      return
    }
    await fetchRewards(currentUser!.family_id!)
  }

  const handleDeleteReward = async (reward: Reward) => {
    const { error } = await supabase
      .from('rewards')
      .update({ active: false })
      .eq('id', reward.id)
    if (error) throw new Error(error.message)
    await fetchRewards(currentUser!.family_id!)
  }

  const handleLoadMore = async () => {
    setLoadingMore(true)
    const { data, count } = await fetchMyRedemptions(currentUser!.id, redemptionOffset)
    setMyRedemptions((prev) => [...prev, ...data])
    setHasMoreRedemptions(count > redemptionOffset + PAGE_SIZE)
    setRedemptionOffset((prev) => prev + PAGE_SIZE)
    setLoadingMore(false)
  }

  const handleOpenForm = (reward?: Reward) => {
    setEditingReward(reward ?? null)
    setIsFormOpen(true)
  }

  const handleFormSubmit = async (formData: RewardFormData) => {
    if (editingReward) {
      await handleUpdateReward(formData)
    } else {
      await handleCreateReward(formData)
    }
  }

  const setTab = (tab: Tab) => {
    router.push(`?tab=${tab}`)
  }

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

  const isParent = currentUser.role === 'parent'
  const topThree = members.slice(0, 3)
  const rest = members.slice(3)
  const activeRewards = rewards.filter((r) => r.active)
  const pendingCount = pendingApprovals.length

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'store', label: 'Store', show: true },
    { id: 'my-rewards', label: 'My Rewards', show: true },
    { id: 'manage', label: 'Manage', show: isParent },
    { id: 'approvals', label: `Approvals${pendingCount > 0 ? ` (${pendingCount})` : ''}`, show: isParent },
  ]

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

      {/* Rewards section */}
      <section className="pt-2">
        {/* Points display */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg font-bold text-purple-600">{currentUser.points} pts available</span>
          {pendingPointsCost > 0 && (
            <span className="text-sm text-yellow-600">
              ({pendingPointsCost} pending approval)
            </span>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
          {tabs
            .filter((t) => t.show)
            .map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex-shrink-0 px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
        </div>

        {/* Tab content */}
        {activeTab === 'store' && (
          <RewardStore
            rewards={activeRewards}
            userPoints={currentUser.points}
            userRole={currentUser.role}
            onRedeem={handleRedeem}
          />
        )}

        {activeTab === 'my-rewards' && (
          <RedemptionHistory
            redemptions={myRedemptions}
            hasMore={hasMoreRedemptions}
            onLoadMore={handleLoadMore}
            loadingMore={loadingMore}
          />
        )}

        {activeTab === 'manage' && isParent && (
          <ManageRewards
            rewards={rewards}
            onAdd={() => handleOpenForm()}
            onEdit={(r) => handleOpenForm(r)}
            onToggle={handleToggleActive}
            onDelete={handleDeleteReward}
          />
        )}

        {activeTab === 'approvals' && isParent && (
          <ApprovalQueue
            redemptions={pendingApprovals}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </section>

      {/* Reward form modal */}
      <RewardForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleFormSubmit}
        reward={editingReward ?? undefined}
      />
    </div>
  )
}

export default function RewardsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      }
    >
      <RewardsPageContent />
    </Suspense>
  )
}
