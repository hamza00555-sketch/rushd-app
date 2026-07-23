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

export type SharedWish = {
  id: string
  title: string
  icon: string
  saved: number
  target: number
  deadline: string
  owner: string
}

export type SharedMarketBudget = {
  monthKey: string
  amount: number
}

export type SharedMarketExpense = {
  id: string
  title: string
  amount: number
  owner: string
  occurredAt: Date
  dateLabel: string
}

export type SharedWorkspaceData = {
  householdId: string
  isOwner: boolean
  wishes: SharedWish[]
  marketBudget: SharedMarketBudget | null
  marketExpenses: SharedMarketExpense[]
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

  if (savedHouseholdId) {
    const membershipSnapshot = await getDoc(doc(db, 'households', savedHouseholdId, 'members', user.uid))
    if (membershipSnapshot.exists() || await restoreOwnerMembership(user, savedHouseholdId)) return savedHouseholdId
  }

  const email = normalizeEmail(user.email || '')
  if (email) {
    const inviteRef = doc(db, 'householdInvites', email)
    const inviteSnapshot = await getDoc(inviteRef)
    if (inviteSnapshot.exists()) {
      const invite = inviteSnapshot.data()
      const householdId = String(invite.householdId)
      await setDoc(doc(db, 'households', householdId, 'members', user.uid), {
        userId: user.uid,
        displayName: getUserName(user),
        email,
        role: 'member',
        status: 'active',
        permissions: invite.permissions || defaultMemberPermissions,
        joinedAt: serverTimestamp(),
      })
      await setDoc(profileRef, {
        displayName: getUserName(user),
        email,
        householdId,
        createdAt: profileSnapshot.exists() ? profileSnapshot.data().createdAt : serverTimestamp(),
      }, { merge: true })
      await deleteDoc(inviteRef)
      await insertActivity(householdId, user, 'انضم إلى البيت', email)
      return householdId
    }
  }

  const householdRef = doc(collection(db, 'households'))
  const householdId = householdRef.id
  const householdName = `بيت ${getUserName(user)}`
  await setDoc(householdRef, {
    name: householdName,
    ownerId: user.uid,
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

export const loadSharedWorkspaceData = async (user: User, marketMonthKey: string): Promise<SharedWorkspaceData> => {
  const householdId = await ensureHousehold(user)
  const membershipSnapshot = await getDoc(doc(db, 'households', householdId, 'members', user.uid))
  if (!membershipSnapshot.exists()) throw new Error('تعذر التحقق من صلاحيات مساحة العائلة.')
  const membership = membershipSnapshot.data()
  const isOwner = membership.role === 'owner'
  const permissions = (isOwner ? ownerPermissions : membership.permissions || defaultMemberPermissions) as Record<SharedModule, AccessLevel>
  const canViewMarket = permissions.market === 'view' || permissions.market === 'edit'
  const canViewWishes = permissions.wishes === 'view' || permissions.wishes === 'edit'
  const [marketSnapshot, wishesSnapshot] = await Promise.all([
    canViewMarket ? getDocs(query(collection(db, 'households', householdId, 'marketItems'), where('monthKey', '==', marketMonthKey))) : null,
    canViewWishes ? getDocs(query(collection(db, 'households', householdId, 'wishes'), orderBy('createdAt', 'asc'))) : null,
  ])

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
    permissions,
    marketBudget: marketBudgetData && Number(marketBudgetData.budget) > 0 ? {
      monthKey: marketMonthKey,
      amount: Number(marketBudgetData.budget),
    } : null,
    marketExpenses,
    wishes: (wishesSnapshot?.docs ?? []).map((snapshot) => {
      const wish = snapshot.data()
      return {
        id: snapshot.id,
        title: String(wish.title || ''),
        icon: String(wish.icon || '♡'),
        saved: Number(wish.saved || 0),
        target: Number(wish.target || 0),
        deadline: String(wish.deadline || 'بدون موعد'),
        owner: String(wish.ownerName || 'العائلة'),
      }
    }),
  }
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
  input: { title: string; icon: string; target: number; deadline: string },
) => {
  await addDoc(collection(db, 'households', householdId, 'wishes'), {
    title: input.title,
    icon: input.icon,
    target: input.target,
    saved: 0,
    deadline: input.deadline,
    ownerId: user.uid,
    ownerName: getUserName(user),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await insertActivity(householdId, user, 'أضاف أمنية مشتركة', input.title)
}

export const subscribeToSharedData = (
  householdId: string,
  permissions: Record<SharedModule, AccessLevel>,
  marketMonthKey: string,
  onChange: () => void,
  onError?: (cause: unknown) => void,
): Unsubscribe => {
  const unsubscribers: Unsubscribe[] = []
  if (permissions.market !== 'none') {
    unsubscribers.push(onSnapshot(
      query(collection(db, 'households', householdId, 'marketItems'), where('monthKey', '==', marketMonthKey)),
      onChange,
      onError,
    ))
  }
  if (permissions.wishes !== 'none') {
    unsubscribers.push(onSnapshot(collection(db, 'households', householdId, 'wishes'), onChange, onError))
  }
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
}

export const subscribeToMemberAccess = (
  householdId: string,
  userId: string,
  onChange: () => void,
  onError?: (cause: unknown) => void,
) => onSnapshot(doc(db, 'households', householdId, 'members', userId), onChange, onError)
