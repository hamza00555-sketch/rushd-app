import { isSupabaseConfigured, supabase } from './supabase'
import type { FinancialGoal, InvestmentAccount } from './wealthEngine'

type AccountRow = {
  id: string
  name: string
  account_type: InvestmentAccount['type']
  balance: number | string
  monthly_contribution: number | string
  annual_return: number | string
  icon: string
}

type GoalRow = {
  id: string
  name: string
  target: number | string
  saved: number | string
  monthly_contribution: number | string
  priority: FinancialGoal['priority']
  linked_wish: string | null
  icon: string
}

const ensureReady = () => {
  if (!isSupabaseConfigured) throw new Error('Supabase غير مفعّل بعد.')
}

const throwOnError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export const getWealthUserId = async () => {
  if (!isSupabaseConfigured) return null
  const { data, error } = await supabase.auth.getUser()
  throwOnError(error)
  return data.user?.id ?? null
}

export const loadWealthData = async (userId: string) => {
  ensureReady()
  const [accountsResult, goalsResult] = await Promise.all([
    supabase.from('investment_accounts').select('id,name,account_type,balance,monthly_contribution,annual_return,icon').eq('user_id', userId).order('created_at'),
    supabase.from('financial_goals').select('id,name,target,saved,monthly_contribution,priority,linked_wish,icon').eq('user_id', userId).order('created_at'),
  ])
  throwOnError(accountsResult.error)
  throwOnError(goalsResult.error)

  const accounts = ((accountsResult.data ?? []) as AccountRow[]).map<InvestmentAccount>((row) => ({
    id: row.id,
    name: row.name,
    type: row.account_type,
    balance: Number(row.balance),
    monthlyContribution: Number(row.monthly_contribution),
    annualReturn: Number(row.annual_return),
    icon: row.icon,
  }))
  const goals = ((goalsResult.data ?? []) as GoalRow[]).map<FinancialGoal>((row) => ({
    id: row.id,
    name: row.name,
    target: Number(row.target),
    saved: Number(row.saved),
    monthlyContribution: Number(row.monthly_contribution),
    priority: row.priority,
    linkedWish: row.linked_wish,
    icon: row.icon,
  }))

  return { accounts, goals }
}

export const createInvestmentAccount = async (userId: string, account: Omit<InvestmentAccount, 'id'>) => {
  ensureReady()
  const { data, error } = await supabase.from('investment_accounts').insert({
    user_id: userId,
    name: account.name,
    account_type: account.type,
    balance: account.balance,
    monthly_contribution: account.monthlyContribution,
    annual_return: account.annualReturn,
    icon: account.icon,
  }).select('id,name,account_type,balance,monthly_contribution,annual_return,icon').single()
  throwOnError(error)
  if (!data) throw new Error('تعذر حفظ الحساب الاستثماري.')
  const row = data as AccountRow
  return {
    id: row.id,
    name: row.name,
    type: row.account_type,
    balance: Number(row.balance),
    monthlyContribution: Number(row.monthly_contribution),
    annualReturn: Number(row.annual_return),
    icon: row.icon,
  } satisfies InvestmentAccount
}

export const createFinancialGoal = async (userId: string, goal: Omit<FinancialGoal, 'id'>) => {
  ensureReady()
  const { data, error } = await supabase.from('financial_goals').insert({
    user_id: userId,
    name: goal.name,
    target: goal.target,
    saved: goal.saved,
    monthly_contribution: goal.monthlyContribution,
    priority: goal.priority,
    linked_wish: goal.linkedWish,
    icon: goal.icon,
  }).select('id,name,target,saved,monthly_contribution,priority,linked_wish,icon').single()
  throwOnError(error)
  if (!data) throw new Error('تعذر حفظ الهدف المالي.')
  const row = data as GoalRow
  return {
    id: row.id,
    name: row.name,
    target: Number(row.target),
    saved: Number(row.saved),
    monthlyContribution: Number(row.monthly_contribution),
    priority: row.priority,
    linkedWish: row.linked_wish,
    icon: row.icon,
  } satisfies FinancialGoal
}

export const addGoalContribution = async (userId: string, goal: FinancialGoal, amount: number) => {
  ensureReady()
  const { error } = await supabase.from('financial_goals').update({ saved: goal.saved + amount }).eq('id', goal.id).eq('user_id', userId)
  throwOnError(error)
}
