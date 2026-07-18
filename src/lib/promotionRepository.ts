import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from './supabase'
import type { PromotionProfileId, SavedPromotionScenario } from './promotionEngine'

type PromotionScenarioRow = {
  id: string
  name: string
  current_salary: number | string
  new_salary: number | string
  profile_id: PromotionProfileId
  increase_amount: number | string
  increase_rate: number | string
  created_at: string
}

const ensureConfigured = () => {
  if (!isSupabaseConfigured) throw new Error('Supabase غير مفعّل بعد.')
}

const throwOnError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

const mapScenario = (row: PromotionScenarioRow): SavedPromotionScenario => ({
  id: row.id,
  name: row.name,
  currentSalary: Number(row.current_salary),
  newSalary: Number(row.new_salary),
  profileId: row.profile_id,
  increase: Number(row.increase_amount),
  increaseRate: Number(row.increase_rate),
  createdAt: row.created_at,
})

export const getPromotionUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.auth.getUser()
  throwOnError(error)
  return data.user
}

export const loadPromotionScenarios = async (userId: string): Promise<SavedPromotionScenario[]> => {
  ensureConfigured()
  const { data, error } = await supabase
    .from('promotion_scenarios')
    .select('id,name,current_salary,new_salary,profile_id,increase_amount,increase_rate,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  throwOnError(error)
  return ((data ?? []) as PromotionScenarioRow[]).map(mapScenario)
}

export const savePromotionScenario = async (
  userId: string,
  input: Omit<SavedPromotionScenario, 'id' | 'createdAt'>,
): Promise<SavedPromotionScenario> => {
  ensureConfigured()
  const { data, error } = await supabase
    .from('promotion_scenarios')
    .insert({
      user_id: userId,
      name: input.name,
      current_salary: input.currentSalary,
      new_salary: input.newSalary,
      profile_id: input.profileId,
      increase_amount: input.increase,
      increase_rate: input.increaseRate,
    })
    .select('id,name,current_salary,new_salary,profile_id,increase_amount,increase_rate,created_at')
    .single()
  throwOnError(error)
  if (!data) throw new Error('تعذر حفظ السيناريو.')
  return mapScenario(data as PromotionScenarioRow)
}

export const deletePromotionScenario = async (userId: string, scenarioId: string) => {
  ensureConfigured()
  const { error } = await supabase
    .from('promotion_scenarios')
    .delete()
    .eq('id', scenarioId)
    .eq('user_id', userId)
  throwOnError(error)
}
