import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db, isFirebaseConfigured } from './firebase'
import type { FinancialGoal, InvestmentAccount } from './wealthEngine'

export const getWealthUserId = async () => auth.currentUser?.uid ?? null

export const loadWealthData = async (userId: string) => {
  const [accountsSnapshot, goalsSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'users', userId, 'investmentAccounts'), orderBy('createdAt', 'asc'))),
    getDocs(query(collection(db, 'users', userId, 'financialGoals'), orderBy('createdAt', 'asc'))),
  ])

  const accounts = accountsSnapshot.docs.map<InvestmentAccount>((item) => {
    const data = item.data()
    return {
      id: item.id,
      name: String(data.name || ''),
      type: data.type as InvestmentAccount['type'],
      balance: Number(data.balance || 0),
      monthlyContribution: Number(data.monthlyContribution || 0),
      annualReturn: Number(data.annualReturn || 0),
      icon: String(data.icon || '↗'),
    }
  })

  const goals = goalsSnapshot.docs.map<FinancialGoal>((item) => {
    const data = item.data()
    return {
      id: item.id,
      name: String(data.name || ''),
      target: Number(data.target || 0),
      saved: Number(data.saved || 0),
      monthlyContribution: Number(data.monthlyContribution || 0),
      priority: data.priority as FinancialGoal['priority'],
      linkedWish: data.linkedWish ? String(data.linkedWish) : null,
      icon: String(data.icon || '◎'),
    }
  })

  return { accounts, goals }
}

export const createInvestmentAccount = async (userId: string, account: Omit<InvestmentAccount, 'id'>) => {
  const reference = await addDoc(collection(db, 'users', userId, 'investmentAccounts'), {
    ...account,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { ...account, id: reference.id } satisfies InvestmentAccount
}

export const createFinancialGoal = async (userId: string, goal: Omit<FinancialGoal, 'id'>) => {
  const reference = await addDoc(collection(db, 'users', userId, 'financialGoals'), {
    ...goal,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { ...goal, id: reference.id } satisfies FinancialGoal
}

export const addGoalContribution = async (userId: string, goal: FinancialGoal, amount: number) => {
  await updateDoc(doc(db, 'users', userId, 'financialGoals', goal.id), {
    saved: goal.saved + amount,
    updatedAt: serverTimestamp(),
  })
}

export { isFirebaseConfigured }
