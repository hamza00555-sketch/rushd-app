import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type Unsubscribe,
  type User,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import {
  type AccessLevel,
  type HouseholdActivity,
  type HouseholdMember,
  type HouseholdWorkspace,
  type SharedModule,
} from './household'
import { auth, authPersistenceReady, db } from './firebase'
import { ARABIC_GREGORIAN_LOCALE } from './locale'
import { normalizeMarketCycleStartDay } from './marketCycle'
import {
  appendWishFundContribution,
  distributeWishesFund,
  getWishFundingCapacityError,
  getWishFundingLevel,
  resolveWishFundingPortfolio,
  roundMoney,
  type WishFundingLevel,
} from './wishesFund'

export type SharedWish = {
  id: string
  title: string
  icon: string
  saved: number
  target: number
  deadline: string
  owner: string
  fundingLevel: WishFundingLevel
  fundingLabel: string
  fundingShare: number
  currentMonthAllocation: number
}

export type SharedWishesBudget = {
  monthKey: string
  amount: number
  allocatedAmount: number
  reserveAmount: number
  updatedByName: string
  updatedAtLabel: string
}

export type SharedMarketBudget = {
  monthKey: string
  amount: number
  updatedByName: string
  updatedAtLabel: string
}

export type SharedMarketExpense = {
  id: string
  title: string
  amount: number
  owner: string
  occurredAt: Date
  dateLabel: string
}

export type SharedChildNeed = {
  id: string
  title: string
  childName: string
  estimatedCost: number
  completed: boolean
  addedByName: string
}

export type SharedWorkspaceData = {
  householdId: string
  isOwner: boolean
  marketCycleStartDay: number
  wishes: SharedWish[]
  wishesBudget: SharedWishesBudget | null
  wishesReserveBalance: number
  marketBudget: SharedMarketBudget | null
  marketExpenses: SharedMarketExpense[]
  childNeeds: SharedChildNeed[]
  permissions: Record<SharedModule, AccessLevel>
}

const ownerPermissions: Record<SharedModule, AccessLevel> = {
  market: 'edit',
  wishes: 'edit',
  noor: 'edit',
}

const defaultMemberPermissions: Record<SharedModule, AccessLevel> = {
  market: 'edit',
  wishes: 'view',
  noor: 'view',
}

const getUserName = (user: User) => user.displayName?.trim() || user.email?.split('@')[0] || 'عضو رُشد'
const getInitials = (name: string) => name.trim().slice(0, 1) || 'ر'
const normalizeEmail = (email: string) => email.trim().toLowerCase()
const getLegacyWishNeedPercent = (fundingLevel: WishFundingLevel) => {
  if (fundingLevel === 'primary') return 10
  if (fundingLevel === 'medium') return 3
  return 1
}

const formatActivityTime = (value: unknown) => {
  const date = value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null
  if (!date) return 'الآن'
  return date.toLocaleString(ARABIC_GREGORIAN_LOCALE, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const insertActivity = async (householdId: string, user: User, action: string, detail: string) => {
  await addDoc(collection(db, 'households', householdId, 'activity'), {
    actorId: user.uid,
    actorName: getUserName(user),
    action,
    detail,
    createdAt: serverTimestamp(),
  })
}

const memberFromSnapshot = (snapshot: QueryDocumentSnapshot<DocumentData>): HouseholdMember => {
  const data = snapshot.data()
  const name = String(data.displayName || data.email?.split('@')[0] || 'عضو')
  return {
    id: snapshot.id,
    name,
    initials: getInitials(name),
    email: String(data.email || ''),
    role: data.role === 'owner' ? 'owner' : 'member',
    status: data.status === 'pending' ? 'pending' : 'active',
    permissions: (data.permissions || defaultMemberPermissions) as Record<SharedModule, AccessLevel>,
  }
}

export const signInToRushd = async (email: string, password: string) => {
  await authPersistenceReady
  const credential = await signInWithEmailAndPassword(auth, normalizeEmail(email), password)
  return credential.user
}

export const signUpToRushd = async (name: string, email: string, password: string) => {
  await authPersistenceReady
  const credential = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password)
  const displayName = name.trim() || normalizeEmail(email).split('@')[0]
  await updateProfile(credential.user, { displayName })
  await setDoc(doc(db, 'users', credential.user.uid), {
    displayName,
    email: normalizeEmail(email),
    createdAt: serverTimestamp(),
  }, { merge: true })
  return credential.user
}

export const signOutFromRushd = async () => {
  await authPersistenceReady
  return signOut(auth)
}

export const loadRushdProfile = async (user: User) => {
  const snapshot = await getDoc(doc(db, 'users', user.uid))
  const data = snapshot.exists() ? snapshot.data() : null
  const displayName = String(data?.displayName || user.displayName || user.email?.split('@')[0] || 'عضو رُشد')
  return { displayName }
}

export const updateRushdProfile = async (user: User, displayNameInput: string) => {
  const displayName = displayNameInput.trim()
  if (displayName.length < 2) throw new Error('اكتب اسمًا من حرفين على الأقل.')
  await updateProfile(user, { displayName })
  await setDoc(doc(db, 'users', user.uid), {
    displayName,
    email: normalizeEmail(user.email || ''),
    updatedAt: serverTimestamp(),
  }, { merge: true })
  return displayName
}

const restoreOwnerMembership = async (user: User, householdId: string) => {
  const householdSnapshot = await getDoc(doc(db, 'households', householdId))
  if (!householdSnapshot.exists() || householdSnapshot.data().ownerId !== user.uid) return false
  await setDoc(doc(db, 'households', householdId, 'members', user.uid), {
    userId: user.uid,
    displayName: getUserName(user),
    email: normalizeEmail(user.email || ''),
    role: 'owner',
    status: 'active',
    permissions: ownerPermissions,
    joinedAt: serverTimestamp(),
  }, { merge: true })
  return true
}

export const ensureHousehold = async (user: User): Promise<string> => {
  const profileRef = doc(db, 'users', user.uid)
  const profileSnapshot = await getDoc(profileRef)
  const savedHouseholdId = profileSnapshot.exists() ? String(profileSnapshot.data().householdId || '') : ''
  const email = normalizeEmail(user.email || '')

  // Always check a direct invitation before returning the user's existing
  // workspace. A newly-created account may already own an empty default home
  // by the time the family owner sends the invitation.
  if (email) {
    const inviteRef = doc(db, 'householdInvites', email)
    const inviteSnapshot = await getDoc(inviteRef)
    if (inviteSnapshot.exists()) {
      const invite = inviteSnapshot.data()
      const householdId = String(invite.householdId)
      const membershipRef = doc(db, 'households', householdId, 'members', user.uid)
      let joinedNow = false
      try {
        await setDoc(membershipRef, {
          userId: user.uid,
          displayName: getUserName(user),
          email,
          role: 'member',
          status: 'active',
          permissions: invite.permissions || defaultMemberPermissions,
          joinedAt: serverTimestamp(),
        })
        joinedNow = true
      } catch (cause) {
        // An invited user cannot read the members collection before joining.
        // If a stale invitation exists for an already-active member, the
        // create becomes an update and is correctly rejected; verify that
        // membership before continuing.
        const existingMembership = await getDoc(membershipRef)
        if (!existingMembership.exists()) throw cause
      }
      await setDoc(profileRef, {
        displayName: getUserName(user),
        email,
        householdId,
        createdAt: profileSnapshot.exists() && profileSnapshot.data().createdAt
          ? profileSnapshot.data().createdAt
          : serverTimestamp(),
      }, { merge: true })
      await deleteDoc(inviteRef)
      if (joinedNow) await insertActivity(householdId, user, 'انضم إلى البيت', email)
      return householdId
    }
  }

  if (savedHouseholdId) {
    const membershipSnapshot = await getDoc(doc(db, 'households', savedHouseholdId, 'members', user.uid))
    if (membershipSnapshot.exists() || await restoreOwnerMembership(user, savedHouseholdId)) return savedHouseholdId
  }

  const householdRef = doc(collection(db, 'households'))
  const householdId = householdRef.id
  const householdName = `بيت ${getUserName(user)}`
  await setDoc(householdRef, {
    name: householdName,
    ownerId: user.uid,
    marketCycleStartDay: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'households', householdId, 'members', user.uid), {
    userId: user.uid,
    displayName: getUserName(user),
    email,
    role: 'owner',
    status: 'active',
    permissions: ownerPermissions,
    joinedAt: serverTimestamp(),
  })
  await setDoc(profileRef, {
    displayName: getUserName(user),
    email,
    householdId,
    createdAt: profileSnapshot.exists() ? profileSnapshot.data().createdAt : serverTimestamp(),
  }, { merge: true })
  await insertActivity(householdId, user, 'أنشأ مساحة العائلة', householdName)
  return householdId
}

export const loadHouseholdWorkspace = async (user: User): Promise<HouseholdWorkspace> => {
  const householdId = await ensureHousehold(user)
  const householdSnapshot = await getDoc(doc(db, 'households', householdId))
  if (!householdSnapshot.exists()) throw new Error('تعذر تحميل مساحة العائلة.')

  const household = householdSnapshot.data()
  const isOwner = household.ownerId === user.uid
  const [membersSnapshot, activitySnapshot] = await Promise.all([
    getDocs(query(collection(db, 'households', householdId, 'members'), orderBy('joinedAt', 'asc'))),
    getDocs(query(collection(db, 'households', householdId, 'activity'), orderBy('createdAt', 'desc'), limit(20))),
  ])

  const members = membersSnapshot.docs.map(memberFromSnapshot)

  if (isOwner) {
    const invitesSnapshot = await getDocs(query(collection(db, 'householdInvites'), where('householdId', '==', householdId)))
    invitesSnapshot.docs.forEach((snapshot) => {
      const data = snapshot.data()
      const email = String(data.email || snapshot.id)
      const name = String(data.displayName || email.split('@')[0])
      members.push({
        id: `invite:${snapshot.id}`,
        name,
        initials: getInitials(name),
        email,
        role: 'member',
        status: 'pending',
        permissions: (data.permissions || defaultMemberPermissions) as Record<SharedModule, AccessLevel>,
      })
    })
  }

  const activity = activitySnapshot.docs.map<HouseholdActivity>((snapshot) => {
    const entry = snapshot.data()
    const action = String(entry.action || '')
    return {
      id: snapshot.id,
      actor: String(entry.actorName || 'عضو رُشد'),
      action,
      detail: String(entry.detail || ''),
      time: formatActivityTime(entry.createdAt),
      icon: action.includes('دعوة') ? '✉' : action.includes('صلاحية') ? '🔐' : action.includes('شراء') ? '🛒' : '⌂',
    }
  })

  return {
    id: householdId,
    name: String(household.name || 'رُشد للعائلة'),
    isOwner,
    members,
    activity,
  }
}

export const inviteHouseholdMember = async (workspace: HouseholdWorkspace, user: User, emailInput: string) => {
  if (!workspace.isOwner) throw new Error('المالك فقط يقدر يرسل الدعوات.')
  const email = normalizeEmail(emailInput)
  if (!email) throw new Error('اكتب البريد الإلكتروني أولًا.')

  await setDoc(doc(db, 'householdInvites', email), {
    householdId: workspace.id,
    email,
    displayName: email.split('@')[0],
    permissions: defaultMemberPermissions,
    invitedBy: user.uid,
    createdAt: serverTimestamp(),
  })
  await insertActivity(workspace.id, user, 'أرسل دعوة', email)
}

export const updateMemberAccess = async (
  workspace: HouseholdWorkspace,
  user: User,
  member: HouseholdMember,
  module: SharedModule,
  access: AccessLevel,
) => {
  if (!workspace.isOwner) throw new Error('المالك فقط يقدر يعدل الصلاحيات.')
  if (member.role === 'owner') return

  const permissions = { ...member.permissions, [module]: access }
  if (member.id.startsWith('invite:')) {
    await updateDoc(doc(db, 'householdInvites', member.id.slice('invite:'.length)), { permissions })
  } else {
    await updateDoc(doc(db, 'households', workspace.id, 'members', member.id), { permissions })
  }
  await insertActivity(workspace.id, user, 'عدّل صلاحية', `${module} لـ ${member.name}: ${access}`)
}

export const subscribeToHousehold = (householdId: string, onChange: () => void): Unsubscribe => {
  const unsubscribers = [
    onSnapshot(collection(db, 'households', householdId, 'members'), onChange),
    onSnapshot(collection(db, 'households', householdId, 'activity'), onChange),
  ]
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
}

export const loadSharedWorkspaceData = async (
  user: User,
  marketMonthKey: string,
  wishesMonthKey: string,
  knownHouseholdId?: string,
): Promise<SharedWorkspaceData> => {
  const householdId = knownHouseholdId || await ensureHousehold(user)
  const [membershipSnapshot, householdSnapshot] = await Promise.all([
    getDoc(doc(db, 'households', householdId, 'members', user.uid)),
    getDoc(doc(db, 'households', householdId)),
  ])
  if (!membershipSnapshot.exists()) throw new Error('تعذر التحقق من صلاحيات مساحة العائلة.')
  if (!householdSnapshot.exists()) throw new Error('تعذر تحميل إعدادات مساحة العائلة.')
  const membership = membershipSnapshot.data()
  const household = householdSnapshot.data()
  const isOwner = membership.role === 'owner'
  const permissions = (isOwner ? ownerPermissions : membership.permissions || defaultMemberPermissions) as Record<SharedModule, AccessLevel>
  const canViewMarket = permissions.market === 'view' || permissions.market === 'edit'
  const canViewWishes = permissions.wishes === 'view' || permissions.wishes === 'edit'
  const canViewChildren = permissions.noor === 'view' || permissions.noor === 'edit'
  const [marketSnapshot, wishesSnapshot, childNeedsSnapshot] = await Promise.all([
    canViewMarket ? getDocs(query(collection(db, 'households', householdId, 'marketItems'), where('monthKey', '==', marketMonthKey))) : null,
    canViewWishes ? getDocs(query(collection(db, 'households', householdId, 'wishes'), orderBy('createdAt', 'asc'))) : null,
    canViewChildren ? getDocs(query(collection(db, 'households', householdId, 'childrenNeeds'), orderBy('createdAt', 'asc'))) : null,
  ])

  const wishesDocuments = wishesSnapshot?.docs ?? []
  const wishesFundDocuments = wishesDocuments.filter((snapshot) => {
    const data = snapshot.data()
    return data.kind === 'fund' || data.kind === 'budget'
  })
  const sharedWishDocuments = wishesDocuments.filter((snapshot) => {
    const kind = snapshot.data().kind
    return kind !== 'budget' && kind !== 'fund'
  })
  const resolvedFundingLevels = resolveWishFundingPortfolio(sharedWishDocuments.map((snapshot) => ({
    id: snapshot.id,
    fundingLevel: snapshot.data().fundingLevel,
    legacyNeedPercent: snapshot.data().needPercent,
  })))
  const wishesBudgetDocument = wishesFundDocuments.find(
    (snapshot) => snapshot.data().monthKey === wishesMonthKey,
  )
  const wishesBudgetData = wishesBudgetDocument?.data()
  const fundReserveBalance = wishesFundDocuments.reduce((total, snapshot) => {
    const fund = snapshot.data()
    const amount = Number(fund.amount ?? fund.budget ?? 0)
    const reserve = Number(fund.reserveAmount)
    return total + (Number.isFinite(reserve) ? Math.max(0, reserve) : Math.max(0, amount))
  }, 0)
  const releasedReserveBalance = sharedWishDocuments.reduce(
    (total, snapshot) => total + Math.max(0, Number(snapshot.data().releasedBalance || 0)),
    0,
  )
  const wishesReserveBalance = roundMoney(fundReserveBalance + releasedReserveBalance)
  const allocatedByWish = new Map<string, number>()
  wishesFundDocuments.forEach((snapshot) => {
    const allocations = snapshot.data().allocations
    if (!allocations || typeof allocations !== 'object' || Array.isArray(allocations)) return
    Object.entries(allocations as Record<string, unknown>).forEach(([wishId, allocation]) => {
      const amount = Math.max(0, Number(allocation || 0))
      if (!Number.isFinite(amount)) return
      allocatedByWish.set(wishId, roundMoney((allocatedByWish.get(wishId) ?? 0) + amount))
    })
  })
  const currentMonthAllocations = wishesBudgetData?.allocations
    && typeof wishesBudgetData.allocations === 'object'
    && !Array.isArray(wishesBudgetData.allocations)
    ? wishesBudgetData.allocations as Record<string, unknown>
    : {}
  const marketDocuments = marketSnapshot?.docs ?? []
  const marketBudgetDocument = marketDocuments.find((snapshot) => {
    const data = snapshot.data()
    return data.kind === 'budget' && data.monthKey === marketMonthKey
  })
  const marketBudgetData = marketBudgetDocument?.data()
  const marketExpenses = marketDocuments
    .filter((snapshot) => {
      const data = snapshot.data()
      return data.kind === 'expense' && data.monthKey === marketMonthKey
    })
    .map<SharedMarketExpense>((snapshot) => {
      const data = snapshot.data()
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date()
      return {
        id: snapshot.id,
        title: String(data.title || 'مشتريات سوبرماركت'),
        amount: Math.max(0, Number(data.amount || 0)),
        owner: String(data.addedByName || 'عضو رُشد'),
        occurredAt: createdAt,
        dateLabel: createdAt.toLocaleString(ARABIC_GREGORIAN_LOCALE, {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        }),
      }
    })
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())

  return {
    householdId,
    isOwner,
    marketCycleStartDay: normalizeMarketCycleStartDay(household.marketCycleStartDay),
    permissions,
    wishesBudget: wishesBudgetData && Number(wishesBudgetData.amount ?? wishesBudgetData.budget) > 0 ? {
      monthKey: wishesMonthKey,
      amount: Number(wishesBudgetData.amount ?? wishesBudgetData.budget),
      allocatedAmount: Math.max(0, Number(wishesBudgetData.allocatedAmount || 0)),
      reserveAmount: Math.max(
        0,
        Number(
          wishesBudgetData.reserveAmount
          ?? wishesBudgetData.amount
          ?? wishesBudgetData.budget
          ?? 0,
        ),
      ),
      updatedByName: String(wishesBudgetData.updatedByName || wishesBudgetData.ownerName || 'عضو رُشد'),
      updatedAtLabel: formatActivityTime(wishesBudgetData.updatedAt || wishesBudgetData.createdAt),
    } : null,
    wishesReserveBalance,
    marketBudget: marketBudgetData && Number(marketBudgetData.budget) > 0 ? {
      monthKey: marketMonthKey,
      amount: Number(marketBudgetData.budget),
      updatedByName: String(marketBudgetData.updatedByName || marketBudgetData.addedByName || 'رب الأسرة'),
      updatedAtLabel: formatActivityTime(marketBudgetData.updatedAt || marketBudgetData.createdAt),
    } : null,
    marketExpenses,
    childNeeds: (childNeedsSnapshot?.docs ?? []).map((snapshot) => {
      const need = snapshot.data()
      return {
        id: snapshot.id,
        title: String(need.title || ''),
        childName: String(need.childName || 'الأبناء'),
        estimatedCost: Math.max(0, Number(need.estimatedCost || 0)),
        completed: Boolean(need.completed),
        addedByName: String(need.addedByName || 'عضو رُشد'),
      }
    }),
    wishes: sharedWishDocuments.map((snapshot) => {
      const wish = snapshot.data()
      const fundingLevel = resolvedFundingLevels[snapshot.id] ?? 'paused'
      const funding = getWishFundingLevel(fundingLevel)
      return {
        id: snapshot.id,
        title: String(wish.title || ''),
        icon: String(wish.icon || '♡'),
        saved: roundMoney((Number(wish.saved) || 0) + (allocatedByWish.get(snapshot.id) ?? 0)),
        target: Math.max(0, Number(wish.target) || 0),
        deadline: String(wish.deadline || 'بدون موعد'),
        owner: String(wish.ownerName || 'العائلة'),
        fundingLevel,
        fundingLabel: funding.label,
        fundingShare: funding.share,
        currentMonthAllocation: Math.max(0, Number(currentMonthAllocations[snapshot.id] || 0)),
      }
    }),
  }
}

export const saveSharedWishesBudget = async (
  householdId: string,
  user: User,
  monthKey: string,
  contributionInput: number,
) => {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) throw new Error('شهر صندوق الأماني غير صالح.')
  const reference = doc(db, 'households', householdId, 'wishes', `wishes-budget-${monthKey}`)
  const [snapshot, wishesSnapshot] = await Promise.all([
    getDoc(reference),
    getDocs(collection(db, 'households', householdId, 'wishes')),
  ])
  const contribution = Math.max(0.01, roundMoney(contributionInput))
  const currentFundData = snapshot.exists() ? snapshot.data() : null
  const allocatedByWish = new Map<string, number>()

  wishesSnapshot.docs.forEach((wishSnapshot) => {
    const data = wishSnapshot.data()
    if (data.kind !== 'fund' && data.kind !== 'budget') return
    const allocations = data.allocations
    if (!allocations || typeof allocations !== 'object' || Array.isArray(allocations)) return
    Object.entries(allocations as Record<string, unknown>).forEach(([wishId, allocation]) => {
      const allocationAmount = Math.max(0, Number(allocation || 0))
      if (!Number.isFinite(allocationAmount)) return
      allocatedByWish.set(
        wishId,
        roundMoney((allocatedByWish.get(wishId) ?? 0) + allocationAmount),
      )
    })
  })

  const wishDocuments = wishesSnapshot.docs.filter((wishSnapshot) => {
    const kind = wishSnapshot.data().kind
    return kind !== 'fund' && kind !== 'budget'
  })
  const resolvedFundingLevels = resolveWishFundingPortfolio(wishDocuments.map((wishSnapshot) => ({
    id: wishSnapshot.id,
    fundingLevel: wishSnapshot.data().fundingLevel,
    legacyNeedPercent: wishSnapshot.data().needPercent,
  })))
  const distribution = distributeWishesFund(contribution, wishDocuments.map((wishSnapshot) => {
    const wish = wishSnapshot.data()
    return {
      id: wishSnapshot.id,
      target: Math.max(0, Number(wish.target) || 0),
      saved: roundMoney((Number(wish.saved) || 0) + (allocatedByWish.get(wishSnapshot.id) ?? 0)),
      fundingLevel: resolvedFundingLevels[wishSnapshot.id] ?? 'paused',
    }
  }))
  const ledger = appendWishFundContribution(currentFundData, contribution, distribution)

  await setDoc(reference, {
    kind: 'fund',
    monthKey,
    amount: ledger.amount,
    budget: ledger.amount,
    allocations: ledger.allocations,
    allocatedAmount: ledger.allocatedAmount,
    reserveAmount: ledger.reserveAmount,
    ownerId: String(currentFundData?.ownerId || user.uid),
    ownerName: String(currentFundData?.ownerName || getUserName(user)),
    updatedBy: user.uid,
    updatedByName: getUserName(user),
    createdAt: currentFundData?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await insertActivity(
    householdId,
    user,
    snapshot.exists() ? 'أضاف دفعة أخرى لصندوق الأماني' : 'أضاف دفعة لصندوق الأماني',
    `${monthKey} · دفعة ${contribution} ريال · بقي منها ${distribution.reserveAmount} ريال`,
  )
}

export const saveSharedMarketBudget = async (
  householdId: string,
  user: User,
  monthKey: string,
  budget: number,
) => {
  const reference = doc(db, 'households', householdId, 'marketItems', `market-budget-${monthKey}`)
  const snapshot = await getDoc(reference)
  const amount = Math.max(0.01, Math.round(budget * 100) / 100)
  if (snapshot.exists()) {
    await updateDoc(reference, {
      kind: 'budget',
      monthKey,
      budget: amount,
      updatedBy: user.uid,
      updatedByName: getUserName(user),
      updatedAt: serverTimestamp(),
    })
  } else {
    await setDoc(reference, {
      kind: 'budget',
      monthKey,
      budget: amount,
      addedBy: user.uid,
      addedByName: getUserName(user),
      updatedBy: user.uid,
      updatedByName: getUserName(user),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }
  await insertActivity(householdId, user, 'حدّد ميزانية السوبرماركت', `${amount} ريال`)
}

export const saveSharedMarketCycleStartDay = async (
  householdId: string,
  user: User,
  startDayInput: number,
) => {
  const startDay = normalizeMarketCycleStartDay(startDayInput)
  if (startDay !== startDayInput) throw new Error('اختر يومًا من 1 إلى 28.')
  await updateDoc(doc(db, 'households', householdId), {
    marketCycleStartDay: startDay,
    updatedAt: serverTimestamp(),
  })
  await insertActivity(householdId, user, 'عدّل بداية شهر السوبرماركت', `يوم ${startDay} من كل شهر`)
}

export const addSharedMarketExpense = async (
  householdId: string,
  user: User,
  monthKey: string,
  amountInput: number,
  titleInput: string,
) => {
  const amount = Math.max(0.01, Math.round(amountInput * 100) / 100)
  const title = titleInput.trim() || 'مشتريات سوبرماركت'
  await addDoc(collection(db, 'households', householdId, 'marketItems'), {
    kind: 'expense',
    monthKey,
    title,
    amount,
    addedBy: user.uid,
    addedByName: getUserName(user),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await insertActivity(householdId, user, 'خصم من ميزانية السوبرماركت', `${amount} ريال · ${title}`)
}

export const addSharedWish = async (
  householdId: string,
  user: User,
  input: {
    title: string
    icon: string
    target: number
    deadline: string
    fundingLevel: WishFundingLevel
  },
) => {
  const wishesSnapshot = await getDocs(query(
    collection(db, 'households', householdId, 'wishes'),
    orderBy('createdAt', 'asc'),
  ))
  const wishDocuments = wishesSnapshot.docs.filter((snapshot) => {
    const kind = snapshot.data().kind
    return kind !== 'fund' && kind !== 'budget'
  })
  const resolvedLevels = resolveWishFundingPortfolio(wishDocuments.map((snapshot) => ({
    id: snapshot.id,
    fundingLevel: snapshot.data().fundingLevel,
    legacyNeedPercent: snapshot.data().needPercent,
  })))
  const capacityError = getWishFundingCapacityError(
    wishDocuments.map((snapshot) => ({
      id: snapshot.id,
      fundingLevel: resolvedLevels[snapshot.id] ?? 'paused',
    })),
    '__new__',
    input.fundingLevel,
  )
  if (capacityError) throw new Error(capacityError)

  await addDoc(collection(db, 'households', householdId, 'wishes'), {
    kind: 'wish',
    title: input.title,
    icon: input.icon,
    target: input.target,
    saved: 0,
    deadline: input.deadline,
    fundingLevel: input.fundingLevel,
    needPercent: getLegacyWishNeedPercent(input.fundingLevel),
    releasedBalance: 0,
    ownerId: user.uid,
    ownerName: getUserName(user),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await insertActivity(householdId, user, 'أضاف أمنية مشتركة', input.title)
}

export const updateSharedWishFundingLevel = async (
  householdId: string,
  user: User,
  wishId: string,
  fundingLevel: WishFundingLevel,
) => {
  const wishesSnapshot = await getDocs(query(
    collection(db, 'households', householdId, 'wishes'),
    orderBy('createdAt', 'asc'),
  ))
  const wishDocuments = wishesSnapshot.docs.filter((snapshot) => {
    const kind = snapshot.data().kind
    return kind !== 'fund' && kind !== 'budget'
  })
  const resolvedLevels = resolveWishFundingPortfolio(wishDocuments.map((snapshot) => ({
    id: snapshot.id,
    fundingLevel: snapshot.data().fundingLevel,
    legacyNeedPercent: snapshot.data().needPercent,
  })))
  const capacityError = getWishFundingCapacityError(
    wishDocuments.map((snapshot) => ({
      id: snapshot.id,
      fundingLevel: resolvedLevels[snapshot.id] ?? 'paused',
    })),
    wishId,
    fundingLevel,
  )
  if (capacityError) throw new Error(capacityError)
  const funding = getWishFundingLevel(fundingLevel)
  await updateDoc(doc(db, 'households', householdId, 'wishes', wishId), {
    kind: 'wish',
    fundingLevel,
    needPercent: getLegacyWishNeedPercent(fundingLevel),
    updatedBy: user.uid,
    updatedByName: getUserName(user),
    updatedAt: serverTimestamp(),
  })
  await insertActivity(
    householdId,
    user,
    fundingLevel === 'paused' ? 'علّق أمنية' : 'عدّل سرعة أمنية',
    `${funding.label} · يطبق على الدفعات القادمة`,
  )
}

export const resetSharedWishSavings = async (
  householdId: string,
  user: User,
  wishId: string,
) => {
  const wishesSnapshot = await getDocs(collection(db, 'households', householdId, 'wishes'))
  const wishSnapshot = wishesSnapshot.docs.find((snapshot) => snapshot.id === wishId)
  if (!wishSnapshot) throw new Error('تعذر العثور على الأمنية.')
  const wish = wishSnapshot.data()
  const baseSaved = Math.max(0, Number(wish.saved || 0))
  const fundsWithAllocation = wishesSnapshot.docs.filter((snapshot) => {
    const data = snapshot.data()
    if (data.kind !== 'fund' && data.kind !== 'budget') return false
    const allocations = data.allocations
    return Boolean(
      allocations
      && typeof allocations === 'object'
      && !Array.isArray(allocations)
      && Number((allocations as Record<string, unknown>)[wishId]) > 0,
    )
  })
  if (fundsWithAllocation.length > 490) {
    throw new Error('سجل الأمنية كبير جدًا للتصفير دفعة واحدة. تواصل مع الدعم.')
  }

  const batch = writeBatch(db)
  let returnedFromFunds = 0
  fundsWithAllocation.forEach((fundSnapshot) => {
    const fund = fundSnapshot.data()
    const allocations = { ...(fund.allocations as Record<string, unknown>) }
    returnedFromFunds = roundMoney(returnedFromFunds + Math.max(0, Number(allocations[wishId] || 0)))
    delete allocations[wishId]
    const normalizedAllocations: Record<string, number> = {}
    Object.entries(allocations).forEach(([allocationWishId, allocation]) => {
      const amount = Math.max(0, Number(allocation || 0))
      if (Number.isFinite(amount) && amount > 0) normalizedAllocations[allocationWishId] = roundMoney(amount)
    })
    const allocatedAmount = roundMoney(
      Object.values(normalizedAllocations).reduce((total, allocation) => total + allocation, 0),
    )
    const amount = Math.max(0, Number(fund.amount ?? fund.budget ?? 0))
    batch.update(fundSnapshot.ref, {
      kind: 'fund',
      amount,
      budget: amount,
      allocations: normalizedAllocations,
      allocatedAmount,
      reserveAmount: roundMoney(Math.max(0, amount - allocatedAmount)),
      updatedBy: user.uid,
      updatedByName: getUserName(user),
      updatedAt: serverTimestamp(),
    })
  })

  const currentFundingLevel = getWishFundingLevel(wish.fundingLevel, wish.needPercent).id
  batch.update(wishSnapshot.ref, {
    kind: 'wish',
    saved: 0,
    fundingLevel: currentFundingLevel,
    needPercent: getLegacyWishNeedPercent(currentFundingLevel),
    releasedBalance: roundMoney(Math.max(0, Number(wish.releasedBalance || 0)) + baseSaved),
    updatedBy: user.uid,
    updatedByName: getUserName(user),
    updatedAt: serverTimestamp(),
  })
  await batch.commit()

  const returnedAmount = roundMoney(baseSaved + returnedFromFunds)
  if (returnedAmount > 0) {
    await insertActivity(
      householdId,
      user,
      'صفّر رصيد أمنية',
      `${String(wish.title || 'أمنية')} · عاد ${returnedAmount} ريال إلى رصيد الصندوق`,
    )
  }
  return returnedAmount
}

export const addSharedChildNeed = async (
  householdId: string,
  user: User,
  input: { title: string; childName: string; estimatedCost: number },
) => {
  const title = input.title.trim()
  const childName = input.childName.trim() || 'الأبناء'
  const estimatedCost = Math.max(0, Math.round(input.estimatedCost * 100) / 100)
  await addDoc(collection(db, 'households', householdId, 'childrenNeeds'), {
    title,
    childName,
    estimatedCost,
    completed: false,
    addedBy: user.uid,
    addedByName: getUserName(user),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await insertActivity(householdId, user, 'أضاف احتياجًا للأبناء', `${childName} · ${title}`)
}

export const setSharedChildNeedCompleted = async (
  householdId: string,
  user: User,
  needId: string,
  completed: boolean,
) => {
  await updateDoc(doc(db, 'households', householdId, 'childrenNeeds', needId), {
    completed,
    updatedBy: user.uid,
    updatedByName: getUserName(user),
    updatedAt: serverTimestamp(),
  })
  await insertActivity(householdId, user, completed ? 'أكمل احتياجًا للأبناء' : 'أعاد احتياجًا للأبناء', needId)
}

export const subscribeToSharedData = (
  householdId: string,
  permissions: Record<SharedModule, AccessLevel>,
  marketMonthKey: string,
  onChange: () => void,
  onError?: (cause: unknown) => void,
): Unsubscribe => {
  const afterInitialSnapshot = () => {
    let ready = false
    return () => {
      if (!ready) {
        ready = true
        return
      }
      onChange()
    }
  }
  const unsubscribers: Unsubscribe[] = [
    onSnapshot(doc(db, 'households', householdId), afterInitialSnapshot(), onError),
  ]
  if (permissions.market !== 'none') {
    unsubscribers.push(onSnapshot(
      query(collection(db, 'households', householdId, 'marketItems'), where('monthKey', '==', marketMonthKey)),
      afterInitialSnapshot(),
      onError,
    ))
  }
  if (permissions.wishes !== 'none') {
    unsubscribers.push(onSnapshot(
      collection(db, 'households', householdId, 'wishes'),
      afterInitialSnapshot(),
      onError,
    ))
  }
  if (permissions.noor !== 'none') {
    unsubscribers.push(onSnapshot(
      collection(db, 'households', householdId, 'childrenNeeds'),
      afterInitialSnapshot(),
      onError,
    ))
  }
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
}

export const subscribeToMemberAccess = (
  householdId: string,
  userId: string,
  onChange: () => void,
  onError?: (cause: unknown) => void,
) => onSnapshot(doc(db, 'households', householdId, 'members', userId), onChange, onError)
