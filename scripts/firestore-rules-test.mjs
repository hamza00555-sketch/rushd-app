import { readFile } from 'node:fs/promises'
import { strict as assert } from 'node:assert'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

const projectId = 'demo-rushd'
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')
const testEnvironment = await initializeTestEnvironment({ projectId, firestore: { rules } })

const ownerId = 'owner-user'
const memberId = 'member-user'
const outsiderId = 'outsider-user'
const ownerEmail = 'owner@example.com'
const memberEmail = 'member@example.com'
const householdId = 'household-one'
const monthKey = '2026-07'

const ownerDb = testEnvironment.authenticatedContext(ownerId, { email: ownerEmail }).firestore()
const memberDb = testEnvironment.authenticatedContext(memberId, { email: memberEmail }).firestore()
const outsiderDb = testEnvironment.authenticatedContext(outsiderId, { email: 'outsider@example.com' }).firestore()
const guestDb = testEnvironment.unauthenticatedContext().firestore()

try {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore()
    await setDoc(doc(adminDb, 'users', ownerId), { displayName: 'Owner', email: ownerEmail })
    await setDoc(doc(adminDb, 'users', memberId), { displayName: 'Member', email: memberEmail })
    await setDoc(doc(adminDb, 'households', householdId), { name: 'Home', ownerId })
    await setDoc(doc(adminDb, 'households', householdId, 'members', ownerId), {
      userId: ownerId,
      email: ownerEmail,
      role: 'owner',
      status: 'active',
      permissions: { market: 'edit', wishes: 'edit', noor: 'edit' },
    })
    await setDoc(doc(adminDb, 'householdInvites', memberEmail), {
      email: memberEmail,
      householdId,
      invitedBy: ownerId,
      permissions: { market: 'edit', wishes: 'view', noor: 'none' },
    })
    await setDoc(doc(adminDb, 'households', householdId, 'marketItems', 'market-budget-2026-07'), {
      kind: 'budget',
      monthKey,
      budget: 1500.5,
      addedBy: ownerId,
    })
    await setDoc(doc(adminDb, 'households', householdId, 'marketItems', 'expense-one'), {
      kind: 'expense',
      monthKey,
      title: 'Weekly groceries',
      amount: 125.75,
      addedBy: ownerId,
    })
    await setDoc(doc(adminDb, 'households', householdId, 'wishes', 'trip'), {
      title: 'Trip',
      ownerId,
      saved: 0,
    })
  })

  const planReference = doc(ownerDb, 'users', ownerId, 'monthlyPlans', monthKey)
  const transactionReference = doc(ownerDb, 'users', ownerId, 'monthlyPlans', monthKey, 'transactions', 'expense-one')

  await assertSucceeds(setDoc(planReference, {
    salary: 12000,
    categories: [{ id: 'needs', title: 'Needs', icon: 'N', limit: 5000, tone: 'violet' }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }))
  await assertSucceeds(setDoc(transactionReference, {
    title: 'Groceries',
    amount: 125,
    categoryId: 'needs',
    occurredAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }))
  await assertSucceeds(getDoc(planReference))
  await assertFails(getDoc(doc(memberDb, 'users', ownerId, 'monthlyPlans', monthKey)))
  await assertFails(getDoc(doc(memberDb, 'users', ownerId, 'monthlyPlans', monthKey, 'transactions', 'expense-one')))
  await assertFails(getDoc(doc(outsiderDb, 'users', ownerId)))
  await assertFails(getDoc(doc(guestDb, 'users', ownerId)))
  await assertSucceeds(getDoc(doc(outsiderDb, 'householdInvites', 'outsider@example.com')))
  await assertFails(getDoc(doc(outsiderDb, 'householdInvites', memberEmail)))
  await assertFails(getDoc(doc(guestDb, 'householdInvites', memberEmail)))
  await assertFails(setDoc(doc(ownerDb, 'users', ownerId, 'monthlyPlans', 'invalid'), {
    salary: 0,
    categories: [],
  }))

  const membershipReference = doc(memberDb, 'households', householdId, 'members', memberId)
  const acceptedPermissions = { market: 'edit', wishes: 'view', noor: 'none' }
  await assertFails(setDoc(membershipReference, {
    userId: memberId,
    email: memberEmail,
    role: 'member',
    status: 'active',
    permissions: { market: 'edit', wishes: 'edit', noor: 'edit' },
  }))
  await assertSucceeds(setDoc(membershipReference, {
    userId: memberId,
    email: memberEmail,
    role: 'member',
    status: 'active',
    permissions: acceptedPermissions,
  }))
  await assertSucceeds(deleteDoc(doc(memberDb, 'householdInvites', memberEmail)))

  const memberMarketBudgetReference = doc(memberDb, 'households', householdId, 'marketItems', 'market-budget-2026-07')
  const memberMarketExpenseReference = doc(memberDb, 'households', householdId, 'marketItems', 'expense-one')
  const memberWishReference = doc(memberDb, 'households', householdId, 'wishes', 'trip')
  await assertSucceeds(getDoc(memberMarketBudgetReference))
  await assertSucceeds(getDoc(memberMarketExpenseReference))
  await assertSucceeds(updateDoc(memberMarketBudgetReference, { budget: 1400.25 }))
  await assertFails(updateDoc(memberMarketBudgetReference, { addedBy: memberId }))
  await assertFails(setDoc(doc(memberDb, 'households', householdId, 'marketItems', 'forged'), {
    kind: 'expense',
    monthKey,
    title: 'Forged expense',
    amount: 99,
    addedBy: ownerId,
  }))
  await assertSucceeds(setDoc(doc(memberDb, 'households', householdId, 'marketItems', 'member-expense'), {
    kind: 'expense',
    monthKey,
    title: 'Member groceries',
    amount: 85.25,
    addedBy: memberId,
  }))
  await assertSucceeds(getDoc(memberWishReference))
  await assertFails(updateDoc(memberWishReference, { saved: 100 }))

  await assertSucceeds(updateDoc(doc(ownerDb, 'households', householdId, 'members', memberId), {
    permissions: { market: 'none', wishes: 'view', noor: 'none' },
  }))
  await assertFails(getDoc(memberMarketBudgetReference))
  await assertFails(getDoc(memberMarketExpenseReference))
  await assertFails(getDoc(doc(memberDb, 'users', ownerId, 'investmentAccounts', 'private-account')))

  const persistedPlan = await assertSucceeds(getDoc(planReference))
  assert.equal(persistedPlan.data()?.salary, 12000)
  process.stdout.write('Firestore rules tests passed.\n')
} finally {
  await testEnvironment.clearFirestore()
  await testEnvironment.cleanup()
}
