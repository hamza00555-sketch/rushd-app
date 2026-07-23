import { readFile } from 'node:fs/promises'
import { strict as assert } from 'node:assert'
import { deleteApp, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

const source = await readFile(new URL('../src/lib/firebase.ts', import.meta.url), 'utf8')

const readConfigValue = (key) => {
  const envKey = `FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`
  if (process.env[envKey]) return process.env[envKey]
  const match = source.match(new RegExp(`${key}:\\s*['\"]([^'\"]+)['\"]`))
  if (!match) throw new Error(`Firebase config value not found: ${key}`)
  return match[1]
}

const firebaseConfig = {
  apiKey: readConfigValue('apiKey'),
  authDomain: readConfigValue('authDomain'),
  projectId: readConfigValue('projectId'),
  storageBucket: readConfigValue('storageBucket'),
  messagingSenderId: readConfigValue('messagingSenderId'),
  appId: readConfigValue('appId'),
}

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
const ownerEmail = `rushd-smoke-owner-${runId}@example.com`
const memberEmail = `rushd-smoke-member-${runId}@example.com`
const password = `Rushd-${runId}-A9!`
const householdId = `smoke-${runId}`
const marketBudgetId = `market-budget-${runId}`
const marketExpenseId = `market-expense-${runId}`
const wishId = `wish-${runId}`
const monthKey = '2099-01'
const nextMonthKey = '2099-02'
const transactionId = `transaction-${runId}`
const accountId = `account-${runId}`
const goalId = `goal-${runId}`
const scenarioId = `scenario-${runId}`

const ownerApp = initializeApp(firebaseConfig, `rushd-owner-${runId}`)
const memberApp = initializeApp(firebaseConfig, `rushd-member-${runId}`)
const ownerAuth = getAuth(ownerApp)
const memberAuth = getAuth(memberApp)
const ownerDb = getFirestore(ownerApp)
const memberDb = getFirestore(memberApp)

let ownerUser = null
let memberUser = null
let ownerUid = ''
let memberUid = ''

const safeDeleteDoc = async (reference) => {
  try {
    await deleteDoc(reference)
  } catch {
    // Best-effort cleanup for disposable smoke-test documents.
  }
}

const safeDeleteUser = async (user) => {
  if (!user) return
  try {
    await deleteUser(user)
  } catch {
    // Best-effort cleanup for disposable smoke-test accounts.
  }
}

const expectPermissionDenied = async (operation, message) => {
  let blocked = false
  try {
    await operation()
  } catch (error) {
    blocked = error?.code === 'permission-denied'
  }
  assert.equal(blocked, true, message)
}

try {
  const ownerCredential = await createUserWithEmailAndPassword(ownerAuth, ownerEmail, password)
  ownerUser = ownerCredential.user
  ownerUid = ownerUser.uid

  const memberCredential = await createUserWithEmailAndPassword(memberAuth, memberEmail, password)
  memberUser = memberCredential.user
  memberUid = memberUser.uid

  await setDoc(doc(ownerDb, 'users', ownerUid), {
    displayName: 'Rushd Smoke Owner',
    email: ownerEmail,
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(memberDb, 'users', memberUid), {
    displayName: 'Rushd Smoke Member',
    email: memberEmail,
    createdAt: serverTimestamp(),
  })

  const missingInviteSnapshot = await getDoc(doc(ownerDb, 'householdInvites', ownerEmail))
  assert.equal(
    missingInviteSnapshot.exists(),
    false,
    'A new user could not verify that no household invite exists.',
  )

  await setDoc(doc(ownerDb, 'households', householdId), {
    name: 'Rushd launch smoke household',
    ownerId: ownerUid,
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(ownerDb, 'households', householdId, 'members', ownerUid), {
    userId: ownerUid,
    displayName: 'Owner',
    email: ownerEmail,
    role: 'owner',
    status: 'active',
    permissions: { market: 'edit', wishes: 'edit', noor: 'edit' },
    joinedAt: serverTimestamp(),
  })

  const memberPermissions = { market: 'edit', wishes: 'view', noor: 'none' }
  await setDoc(doc(ownerDb, 'householdInvites', memberEmail), {
    email: memberEmail,
    householdId,
    displayName: 'Member',
    permissions: memberPermissions,
    invitedBy: ownerUid,
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(memberDb, 'households', householdId, 'members', memberUid), {
    userId: memberUid,
    displayName: 'Member',
    email: memberEmail,
    role: 'member',
    status: 'active',
    permissions: memberPermissions,
    joinedAt: serverTimestamp(),
  })
  await deleteDoc(doc(memberDb, 'householdInvites', memberEmail))

  await setDoc(doc(ownerDb, 'households', householdId, 'marketItems', marketBudgetId), {
    kind: 'budget',
    monthKey,
    budget: 1500.5,
    addedBy: ownerUid,
    addedByName: 'Owner',
    updatedBy: ownerUid,
    updatedByName: 'Owner',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await setDoc(doc(ownerDb, 'households', householdId, 'marketItems', marketExpenseId), {
    kind: 'expense',
    monthKey,
    title: 'Live smoke groceries',
    amount: 125.75,
    addedBy: ownerUid,
    addedByName: 'Owner',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await setDoc(doc(ownerDb, 'households', householdId, 'wishes', wishId), {
    title: 'Live smoke wish',
    icon: '◎',
    target: 1000,
    saved: 0,
    deadline: '2099',
    ownerId: ownerUid,
    ownerName: 'Owner',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  try {
    await setDoc(doc(ownerDb, 'users', ownerUid, 'monthlyPlans', monthKey), {
      salary: 12000,
      categories: [{ id: 'needs', title: 'Needs', icon: 'N', limit: 5000, tone: 'violet' }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  } catch (cause) {
    throw new Error('Live Firestore rules do not allow private monthly plans yet. Deploy the repository firestore.rules before rerunning this smoke test.', { cause })
  }
  await setDoc(doc(ownerDb, 'users', ownerUid, 'monthlyPlans', monthKey, 'transactions', transactionId), {
    title: 'Smoke expense',
    amount: 125,
    categoryId: 'needs',
    occurredAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(ownerDb, 'users', ownerUid, 'monthlyPlans', nextMonthKey), {
    salary: 12500,
    categories: [{ id: 'needs', title: 'Needs', icon: 'N', limit: 5200, tone: 'violet' }],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await setDoc(doc(ownerDb, 'users', ownerUid, 'investmentAccounts', accountId), {
    name: 'Smoke account',
    type: 'cash',
    balance: 500,
    monthlyContribution: 50,
    annualReturn: 0,
    icon: '◎',
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(ownerDb, 'users', ownerUid, 'financialGoals', goalId), {
    name: 'Smoke goal',
    target: 2000,
    saved: 0,
    monthlyContribution: 100,
    priority: 'medium',
    linkedWish: null,
    icon: 'G',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await updateDoc(doc(ownerDb, 'users', ownerUid, 'financialGoals', goalId), {
    saved: 250,
    updatedAt: serverTimestamp(),
  })
  await setDoc(doc(ownerDb, 'users', ownerUid, 'promotionScenarios', scenarioId), {
    name: 'Smoke scenario',
    currentSalary: 12000,
    newSalary: 14000,
    profileId: 'balanced',
    increase: 2000,
    increaseRate: 17,
    createdAt: serverTimestamp(),
  })

  const householdSnapshot = await getDoc(doc(memberDb, 'households', householdId))
  assert.equal(householdSnapshot.exists(), true, 'Invited member could not read the household.')

  const marketBudgetSnapshot = await getDoc(doc(memberDb, 'households', householdId, 'marketItems', marketBudgetId))
  assert.equal(marketBudgetSnapshot.data()?.budget, 1500.5)
  const marketExpenseSnapshot = await getDoc(doc(memberDb, 'households', householdId, 'marketItems', marketExpenseId))
  assert.equal(marketExpenseSnapshot.data()?.amount, 125.75)
  const wishSnapshot = await getDoc(doc(memberDb, 'households', householdId, 'wishes', wishId))
  assert.equal(wishSnapshot.data()?.title, 'Live smoke wish')

  let unsubscribeRealtime = () => undefined
  const realtimeUpdate = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime supermarket budget update timed out.')), 8000)
    unsubscribeRealtime = onSnapshot(doc(ownerDb, 'households', householdId, 'marketItems', marketBudgetId), (snapshot) => {
      if (snapshot.data()?.budget === 1400.25) {
        clearTimeout(timeout)
        resolve()
      }
    }, reject)
  })
  await updateDoc(doc(memberDb, 'households', householdId, 'marketItems', marketBudgetId), {
    budget: 1400.25,
    updatedBy: memberUid,
    updatedByName: 'Member',
    updatedAt: serverTimestamp(),
  })
  await realtimeUpdate
  unsubscribeRealtime()

  await expectPermissionDenied(
    () => updateDoc(doc(memberDb, 'households', householdId, 'wishes', wishId), { saved: 100 }),
    'A view-only member could edit a shared wish.',
  )
  await expectPermissionDenied(
    () => getDoc(doc(memberDb, 'users', ownerUid)),
    'A household member could read the owner private user document.',
  )
  await expectPermissionDenied(
    () => getDoc(doc(memberDb, 'users', ownerUid, 'monthlyPlans', monthKey)),
    'A household member could read the owner monthly plan.',
  )
  await expectPermissionDenied(
    () => getDoc(doc(memberDb, 'users', ownerUid, 'monthlyPlans', monthKey, 'transactions', transactionId)),
    'A household member could read an owner transaction.',
  )
  await expectPermissionDenied(
    () => getDoc(doc(memberDb, 'users', ownerUid, 'investmentAccounts', accountId)),
    'A household member could read the owner investment data.',
  )
  await expectPermissionDenied(
    () => getDoc(doc(memberDb, 'users', ownerUid, 'financialGoals', goalId)),
    'A household member could read the owner goal data.',
  )
  await expectPermissionDenied(
    () => getDoc(doc(memberDb, 'users', ownerUid, 'promotionScenarios', scenarioId)),
    'A household member could read the owner promotion scenario.',
  )

  await updateDoc(doc(ownerDb, 'households', householdId, 'members', memberUid), {
    permissions: { market: 'none', wishes: 'view', noor: 'none' },
  })
  await expectPermissionDenied(
    () => getDoc(doc(memberDb, 'households', householdId, 'marketItems', marketBudgetId)),
    'A member with no market access could still read the supermarket budget.',
  )
  await expectPermissionDenied(
    () => getDoc(doc(memberDb, 'households', householdId, 'marketItems', marketExpenseId)),
    'A member with no market access could still read supermarket expenses.',
  )

  await signOut(ownerAuth)
  ownerUser = (await signInWithEmailAndPassword(ownerAuth, ownerEmail, password)).user

  const ownerPlanSnapshot = await getDoc(doc(ownerDb, 'users', ownerUid, 'monthlyPlans', monthKey))
  const nextMonthSnapshot = await getDoc(doc(ownerDb, 'users', ownerUid, 'monthlyPlans', nextMonthKey))
  const ownerTransactionSnapshot = await getDoc(doc(ownerDb, 'users', ownerUid, 'monthlyPlans', monthKey, 'transactions', transactionId))
  const ownerGoalSnapshot = await getDoc(doc(ownerDb, 'users', ownerUid, 'financialGoals', goalId))
  const ownerScenarioSnapshot = await getDoc(doc(ownerDb, 'users', ownerUid, 'promotionScenarios', scenarioId))
  assert.equal(ownerPlanSnapshot.data()?.salary, 12000, 'Monthly plan did not persist.')
  assert.equal(nextMonthSnapshot.data()?.salary, 12500, 'Creating a new month damaged monthly history.')
  assert.equal(ownerTransactionSnapshot.data()?.amount, 125, 'Monthly transaction did not persist.')
  assert.equal(ownerGoalSnapshot.data()?.saved, 250, 'Goal contribution did not persist.')
  assert.equal(ownerScenarioSnapshot.data()?.newSalary, 14000, 'Promotion scenario did not persist.')
  await deleteDoc(doc(ownerDb, 'users', ownerUid, 'promotionScenarios', scenarioId))
  assert.equal((await getDoc(doc(ownerDb, 'users', ownerUid, 'promotionScenarios', scenarioId))).exists(), false, 'Promotion scenario was not deleted.')

  process.stdout.write('Firebase live smoke test passed: private monthly data, shared supermarket budget, household permissions, and realtime sync are working.\n')
} finally {
  if (ownerUid) {
    await safeDeleteDoc(doc(ownerDb, 'users', ownerUid, 'monthlyPlans', monthKey, 'transactions', transactionId))
    await safeDeleteDoc(doc(ownerDb, 'users', ownerUid, 'monthlyPlans', monthKey))
    await safeDeleteDoc(doc(ownerDb, 'users', ownerUid, 'monthlyPlans', nextMonthKey))
    await safeDeleteDoc(doc(ownerDb, 'users', ownerUid, 'investmentAccounts', accountId))
    await safeDeleteDoc(doc(ownerDb, 'users', ownerUid, 'financialGoals', goalId))
    await safeDeleteDoc(doc(ownerDb, 'users', ownerUid, 'promotionScenarios', scenarioId))
    await safeDeleteDoc(doc(ownerDb, 'households', householdId, 'wishes', wishId))
    await safeDeleteDoc(doc(ownerDb, 'households', householdId, 'marketItems', marketExpenseId))
    await safeDeleteDoc(doc(ownerDb, 'households', householdId, 'marketItems', marketBudgetId))
    if (memberUid) await safeDeleteDoc(doc(ownerDb, 'households', householdId, 'members', memberUid))
    await safeDeleteDoc(doc(ownerDb, 'households', householdId, 'members', ownerUid))
    await safeDeleteDoc(doc(ownerDb, 'householdInvites', memberEmail))
    await safeDeleteDoc(doc(ownerDb, 'households', householdId))
    await safeDeleteDoc(doc(ownerDb, 'users', ownerUid))
  }
  if (memberUid) await safeDeleteDoc(doc(memberDb, 'users', memberUid))
  await safeDeleteUser(memberUser)
  await safeDeleteUser(ownerUser)
  await Promise.allSettled([deleteApp(memberApp), deleteApp(ownerApp)])
}
