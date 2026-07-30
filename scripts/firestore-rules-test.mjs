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
    await setDoc(doc(adminDb, 'households', householdId), {
      name: 'Home',
      ownerId,
      marketCycleStartDay: 1,
    })
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
      permissions: { market: 'edit', wishes: 'view', noor: 'edit' },
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
      kind: 'wish',
      title: 'Trip',
      icon: '♡',
      target: 2000,
      ownerId,
      ownerName: 'Owner',
      saved: 0,
      deadline: 'No deadline',
      fundingLevel: 'primary',
      releasedBalance: 0,
    })
    await setDoc(doc(adminDb, 'households', householdId, 'wishes', `wishes-budget-${monthKey}`), {
      kind: 'fund',
      monthKey,
      amount: 500,
      budget: 500,
      allocations: { trip: 25 },
      allocatedAmount: 25,
      reserveAmount: 475,
      ownerId,
      updatedBy: ownerId,
      updatedByName: 'Owner',
    })
    await setDoc(doc(adminDb, 'households', householdId, 'childrenNeeds', 'school-shoes'), {
      title: 'School shoes',
      childName: 'Noor',
      estimatedCost: 180,
      completed: false,
      addedBy: ownerId,
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

  const ratibiMonth = '2026-08'
  const ratibiSnapshot = {
    schema: 'ratibi.rushd.finance',
    version: 1,
    exportedAt: '2026-08-01T08:00:00.000Z',
    month: ratibiMonth,
    currency: 'SAR',
    profile: { displayName: 'Owner', salaryDay: 27 },
    income: { salary: 16500, additional: [] },
    obligations: [{ id: 'rent', title: 'Rent', amount: 2166, paidAmount: 2166, dueDate: null, category: 'housing' }],
    goals: [{ id: 'emergency', title: 'Emergency', target: 30000, saved: 5000, monthlyAllocation: 1000, contributedThisMonth: 1000, deadline: null, category: 'safety' }],
    budgets: [{ id: 'wishes', title: 'Wishes', limit: 500, spent: 100, kind: 'wishes' }],
    accounts: [],
    transactions: [],
  }
  const ratibiPlanReference = doc(ownerDb, 'users', ownerId, 'monthlyPlans', ratibiMonth)
  const ratibiSyncReference = doc(ownerDb, 'users', ownerId, 'ratibiSync', ratibiMonth)
  await assertSucceeds(setDoc(ratibiSyncReference, {
    sourceApp: 'ratibi',
    sourceVersion: 1,
    bundle: ratibiSnapshot,
    updatedAt: serverTimestamp(),
  }))
  await assertSucceeds(getDoc(ratibiSyncReference))
  await assertFails(getDoc(doc(memberDb, 'users', ownerId, 'ratibiSync', ratibiMonth)))
  await assertFails(getDoc(doc(guestDb, 'users', ownerId, 'ratibiSync', ratibiMonth)))
  await assertFails(setDoc(doc(ownerDb, 'users', ownerId, 'ratibiSync', '2026-09'), {
    sourceApp: 'ratibi',
    sourceVersion: 1,
    bundle: ratibiSnapshot,
    updatedAt: serverTimestamp(),
  }))
  await assertFails(setDoc(doc(ownerDb, 'users', ownerId, 'ratibiSync', ratibiMonth), {
    sourceApp: 'unknown-app',
    sourceVersion: 1,
    bundle: ratibiSnapshot,
    updatedAt: serverTimestamp(),
  }))
  await assertFails(setDoc(doc(ownerDb, 'users', ownerId, 'ratibiSync', ratibiMonth), {
    sourceApp: 'ratibi',
    sourceVersion: 1,
    bundle: { ...ratibiSnapshot, schema: 'unknown.schema' },
    updatedAt: serverTimestamp(),
  }))
  await assertSucceeds(setDoc(ratibiPlanReference, {
    salary: 16500,
    categories: [{ id: 'commitments', title: 'Commitments', icon: 'C', limit: 2166, spent: 2166, tone: 'lavender' }],
    source: 'ratibi',
    ratibiSnapshot,
    importedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }))
  await assertSucceeds(getDoc(ratibiPlanReference))
  await assertFails(getDoc(doc(memberDb, 'users', ownerId, 'monthlyPlans', ratibiMonth)))
  await assertFails(setDoc(doc(ownerDb, 'users', ownerId, 'monthlyPlans', '2026-09'), {
    salary: 16500,
    categories: [],
    source: 'ratibi',
    ratibiSnapshot,
  }))
  await assertFails(setDoc(doc(ownerDb, 'users', ownerId, 'monthlyPlans', '2026-10'), {
    salary: 16500,
    categories: [],
    source: 'ratibi',
    ratibiSnapshot: { ...ratibiSnapshot, month: '2026-10', schema: 'unknown.schema' },
  }))

  const membershipReference = doc(memberDb, 'households', householdId, 'members', memberId)
  const acceptedPermissions = { market: 'edit', wishes: 'view', noor: 'edit' }
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

  const ownerHouseholdReference = doc(ownerDb, 'households', householdId)
  const memberHouseholdReference = doc(memberDb, 'households', householdId)
  await assertSucceeds(getDoc(memberHouseholdReference))
  await assertFails(updateDoc(memberHouseholdReference, { marketCycleStartDay: 27 }))
  await assertSucceeds(updateDoc(ownerHouseholdReference, { marketCycleStartDay: 27 }))
  assert.equal(
    (await assertSucceeds(getDoc(memberHouseholdReference))).data()?.marketCycleStartDay,
    27,
  )

  const memberMarketBudgetReference = doc(memberDb, 'households', householdId, 'marketItems', 'market-budget-2026-07')
  const memberMarketExpenseReference = doc(memberDb, 'households', householdId, 'marketItems', 'expense-one')
  const ownerMarketBudgetReference = doc(ownerDb, 'households', householdId, 'marketItems', 'market-budget-2026-07')
  const memberWishesBudgetReference = doc(memberDb, 'households', householdId, 'wishes', `wishes-budget-${monthKey}`)
  const ownerWishesBudgetReference = doc(ownerDb, 'households', householdId, 'wishes', `wishes-budget-${monthKey}`)
  const memberWishReference = doc(memberDb, 'households', householdId, 'wishes', 'trip')
  const memberChildNeedReference = doc(memberDb, 'households', householdId, 'childrenNeeds', 'school-shoes')
  await assertSucceeds(getDoc(memberMarketBudgetReference))
  await assertSucceeds(getDoc(memberMarketExpenseReference))
  await assertFails(updateDoc(memberMarketBudgetReference, { budget: 1400.25 }))
  await assertFails(updateDoc(memberMarketBudgetReference, { addedBy: memberId }))
  await assertSucceeds(updateDoc(ownerMarketBudgetReference, { budget: 1400.25 }))
  await assertSucceeds(setDoc(doc(ownerDb, 'households', householdId, 'marketItems', 'market-budget-2026-08'), {
    kind: 'budget',
    monthKey: '2026-08',
    budget: 1700,
    addedBy: ownerId,
  }))
  await assertFails(setDoc(doc(memberDb, 'households', householdId, 'marketItems', 'member-budget'), {
    kind: 'budget',
    monthKey: '2026-08',
    budget: 1700,
    addedBy: memberId,
  }))
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
  const sharedWishesBudget = await assertSucceeds(getDoc(memberWishesBudgetReference))
  assert.equal(sharedWishesBudget.data()?.budget, 500)
  await assertFails(updateDoc(memberWishesBudgetReference, { budget: 700 }))
  await assertSucceeds(updateDoc(ownerWishesBudgetReference, {
    amount: 700,
    budget: 700,
    allocations: { trip: 35 },
    allocatedAmount: 35,
    reserveAmount: 665,
    updatedBy: ownerId,
  }))
  assert.equal(
    (await assertSucceeds(getDoc(memberWishesBudgetReference))).data()?.budget,
    700,
  )
  await assertSucceeds(getDoc(memberWishReference))
  await assertFails(updateDoc(memberWishReference, { saved: 100 }))
  await assertSucceeds(updateDoc(doc(ownerDb, 'households', householdId, 'members', memberId), {
    permissions: { market: 'edit', wishes: 'edit', noor: 'edit' },
  }))
  await assertSucceeds(updateDoc(memberWishReference, {
    fundingLevel: 'paused',
    updatedBy: memberId,
  }))
  await assertFails(updateDoc(memberWishReference, {
    fundingLevel: 'urgent',
    updatedBy: memberId,
  }))
  await assertSucceeds(setDoc(doc(memberDb, 'households', householdId, 'wishes', 'member-wish'), {
    kind: 'wish',
    title: 'Coffee machine',
    icon: '♡',
    target: 900,
    saved: 0,
    deadline: 'No deadline',
    fundingLevel: 'calm',
    releasedBalance: 0,
    ownerId: memberId,
  }))
  await assertSucceeds(setDoc(doc(memberDb, 'households', householdId, 'wishes', 'wishes-budget-2026-08'), {
    kind: 'fund',
    monthKey: '2026-08',
    amount: 600,
    budget: 600,
    allocations: { trip: 60 },
    allocatedAmount: 60,
    reserveAmount: 540,
    ownerId: memberId,
    updatedBy: memberId,
  }))
  await assertSucceeds(updateDoc(memberWishesBudgetReference, {
    allocations: {},
    allocatedAmount: 0,
    reserveAmount: 700,
    updatedBy: memberId,
  }))
  await assertSucceeds(updateDoc(memberWishReference, {
    saved: 0,
    fundingLevel: 'paused',
    releasedBalance: 0,
    updatedBy: memberId,
  }))
  await assertFails(setDoc(doc(memberDb, 'households', householdId, 'wishes', 'invalid-fund'), {
    kind: 'fund',
    monthKey: '2026-08',
    amount: 600,
    budget: 600,
    allocations: { trip: 700 },
    allocatedAmount: 700,
    reserveAmount: 0,
    ownerId: memberId,
    updatedBy: memberId,
  }))
  await assertSucceeds(getDoc(memberChildNeedReference))
  await assertSucceeds(updateDoc(memberChildNeedReference, { completed: true }))
  await assertFails(updateDoc(memberChildNeedReference, { addedBy: memberId }))
  await assertSucceeds(setDoc(doc(memberDb, 'households', householdId, 'childrenNeeds', 'member-need'), {
    title: 'Diapers',
    childName: 'Noor',
    estimatedCost: 75,
    completed: false,
    addedBy: memberId,
  }))

  await assertSucceeds(updateDoc(doc(ownerDb, 'households', householdId, 'members', memberId), {
    permissions: { market: 'view', wishes: 'view', noor: 'view' },
  }))
  await assertSucceeds(getDoc(memberMarketBudgetReference))
  await assertSucceeds(getDoc(memberChildNeedReference))
  await assertFails(updateDoc(memberChildNeedReference, { completed: false }))
  await assertFails(setDoc(doc(memberDb, 'households', householdId, 'marketItems', 'view-only-expense'), {
    kind: 'expense',
    monthKey,
    title: 'Blocked groceries',
    amount: 50,
    addedBy: memberId,
  }))

  await assertSucceeds(updateDoc(doc(ownerDb, 'households', householdId, 'members', memberId), {
    permissions: { market: 'none', wishes: 'view', noor: 'none' },
  }))
  await assertFails(getDoc(memberMarketBudgetReference))
  await assertFails(getDoc(memberMarketExpenseReference))
  await assertFails(getDoc(memberChildNeedReference))
  await assertFails(getDoc(doc(memberDb, 'users', ownerId, 'investmentAccounts', 'private-account')))

  const persistedPlan = await assertSucceeds(getDoc(planReference))
  assert.equal(persistedPlan.data()?.salary, 12000)
  process.stdout.write('Firestore rules tests passed.\n')
} finally {
  await testEnvironment.clearFirestore()
  await testEnvironment.cleanup()
}
