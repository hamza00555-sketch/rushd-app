import { readFile } from 'node:fs/promises'
import { strict as assert } from 'node:assert'
import { deleteApp, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, deleteUser, getAuth } from 'firebase/auth'
import {
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'

const source = await readFile(new URL('../src/lib/firebase.ts', import.meta.url), 'utf8')

const readConfigValue = (key) => {
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
const itemId = `market-${runId}`

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
    // Best-effort cleanup for a disposable smoke-test document.
  }
}

const safeDeleteUser = async (user) => {
  if (!user) return
  try {
    await deleteUser(user)
  } catch {
    // Best-effort cleanup for a disposable smoke-test account.
  }
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

  await setDoc(doc(ownerDb, 'households', householdId), {
    name: 'Rushd launch smoke household',
    ownerId: ownerUid,
    createdAt: serverTimestamp(),
  })

  await setDoc(doc(ownerDb, 'households', householdId, 'members', ownerUid), {
    name: 'Owner',
    email: ownerEmail,
    role: 'owner',
    status: 'active',
    permissions: { market: 'edit', wishes: 'edit', noor: 'edit' },
    joinedAt: serverTimestamp(),
  })

  await setDoc(doc(ownerDb, 'householdInvites', memberEmail), {
    email: memberEmail,
    householdId,
    invitedBy: ownerUid,
    createdAt: serverTimestamp(),
  })

  await setDoc(doc(memberDb, 'households', householdId, 'members', memberUid), {
    name: 'Member',
    email: memberEmail,
    role: 'member',
    status: 'active',
    permissions: { market: 'edit', wishes: 'view', noor: 'none' },
    joinedAt: serverTimestamp(),
  })

  await setDoc(doc(ownerDb, 'households', householdId, 'marketItems', itemId), {
    title: 'Live smoke item',
    quantity: '1',
    owner: 'Owner',
    checked: false,
    createdAt: serverTimestamp(),
  })

  const householdSnapshot = await getDoc(doc(memberDb, 'households', householdId))
  assert.equal(householdSnapshot.exists(), true, 'Invited member could not read the household.')

  const marketSnapshot = await getDoc(doc(memberDb, 'households', householdId, 'marketItems', itemId))
  assert.equal(marketSnapshot.exists(), true, 'Invited member could not read the shared market item.')
  assert.equal(marketSnapshot.data()?.title, 'Live smoke item')

  let privateDataBlocked = false
  try {
    await getDoc(doc(memberDb, 'users', ownerUid))
  } catch (error) {
    privateDataBlocked = error?.code === 'permission-denied'
  }
  assert.equal(privateDataBlocked, true, 'A household member could read the owner private user document.')

  console.log('Firebase live smoke test passed: Auth, invite claiming, shared reads, and private-data isolation are working.')
} finally {
  if (ownerUid) {
    await safeDeleteDoc(doc(ownerDb, 'households', householdId, 'marketItems', itemId))
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
