import type { RealtimeChannel, User } from '@supabase/supabase-js'
import {
  initialHouseholdActivity,
  initialHouseholdMembers,
  sharedModules,
  type AccessLevel,
  type HouseholdActivity,
  type HouseholdMember,
  type HouseholdWorkspace,
  type SharedModule,
} from './household'
import { isSupabaseConfigured, supabase } from './supabase'

export type SharedWish = {
  id: string
  title: string
  icon: string
  saved: number
  target: number
  deadline: string
  owner: string
}

export type SharedMarketItem = {
  id: string
  title: string
  quantity: string
  owner: string
  checked: boolean
}

export type SharedWorkspaceData = {
  householdId: string
  wishes: SharedWish[]
  marketItems: SharedMarketItem[]
}

type HouseholdRow = {
  id: string
  name: string
  owner_id: string
}

type MemberRow = {
  id: string
  household_id: string
  user_id: string | null
  invited_email: string | null
  display_name: string | null
  role: 'owner' | 'member'
  status: 'active' | 'pending'
}

type PermissionRow = {
  household_id: string
  member_id: string
  module: SharedModule
  can_view: boolean
  can_edit: boolean
}

type ActivityRow = {
  id: number
  actor_name: string | null
  action: string
  detail: string | null
  created_at: string
}

type MarketRow = {
  id: string
  title: string
  quantity: string | null
  added_by_name: string | null
  checked: boolean
}

type WishRow = {
  id: string
  title: string
  icon: string | null
  saved: number | string
  target: number | string
  deadline_label: string | null
  owner_name: string | null
}

const getClient = () => {
  if (!supabase) throw new Error('Supabase غير مفعّل بعد.')
  return supabase
}

const throwOnError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

const getUserName = (user: User) => {
  const metadataName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : ''
  return metadataName || user.email?.split('@')[0] || 'عضو رُشد'
}

const getInitials = (name: string) => name.trim().slice(0, 1) || 'ر'

const toAccessLevel = (permission: PermissionRow | undefined): AccessLevel => {
  if (!permission?.can_view) return 'none'
  return permission.can_edit ? 'edit' : 'view'
}

const formatActivityTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'الآن'
  return date.toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const insertActivity = async (householdId: string, user: User, action: string, detail: string) => {
  const client = getClient()
  const { error } = await client.from('household_activity').insert({
    household_id: householdId,
    actor_id: user.id,
    actor_name: getUserName(user),
    action,
    detail,
  })
  throwOnError(error)
}

export const signInToRushd = async (email: string, password: string) => {
  const client = getClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  throwOnError(error)
  return data.user
}

export const signUpToRushd = async (name: string, email: string, password: string) => {
  const client = getClient()
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: name.trim() || email.split('@')[0] } },
  })
  throwOnError(error)
  return data
}

export const signOutFromRushd = async () => {
  const client = getClient()
  const { error } = await client.auth.signOut()
  throwOnError(error)
}

export const ensureHousehold = async (user: User): Promise<string> => {
  const client = getClient()
  await client.rpc('claim_household_invites')

  const { data: membership, error: membershipError } = await client
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  throwOnError(membershipError)
  if (membership?.household_id) return String(membership.household_id)

  const { data: owned, error: ownedError } = await client
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .limit(1)
    .maybeSingle()
  throwOnError(ownedError)

  if (owned?.id) {
    const householdId = String(owned.id)
    const { data: ownerMember, error: ownerMemberError } = await client
      .from('household_members')
      .upsert({
        household_id: householdId,
        user_id: user.id,
        invited_email: user.email?.toLowerCase() ?? null,
        display_name: getUserName(user),
        role: 'owner',
        status: 'active',
        joined_at: new Date().toISOString(),
      }, { onConflict: 'household_id,user_id' })
      .select('id')
      .single()
    throwOnError(ownerMemberError)
    await seedOwnerPermissions(householdId, String(ownerMember.id))
    return householdId
  }

  const { data: household, error: householdError } = await client
    .from('households')
    .insert({ name: `بيت ${getUserName(user)}`, owner_id: user.id })
    .select('id')
    .single()
  throwOnError(householdError)
  const householdId = String(household.id)

  const { data: ownerMember, error: memberError } = await client
    .from('household_members')
    .insert({
      household_id: householdId,
      user_id: user.id,
      invited_email: user.email?.toLowerCase() ?? null,
      display_name: getUserName(user),
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  throwOnError(memberError)
  await seedOwnerPermissions(householdId, String(ownerMember.id))
  await insertActivity(householdId, user, 'أنشأ مساحة العائلة', `تم إنشاء بيت ${getUserName(user)}`)
  return householdId
}

const seedOwnerPermissions = async (householdId: string, memberId: string) => {
  const client = getClient()
  const { error } = await client.from('module_permissions').upsert(
    sharedModules.map((module) => ({
      household_id: householdId,
      member_id: memberId,
      module,
      can_view: true,
      can_edit: true,
    })),
    { onConflict: 'member_id,module' },
  )
  throwOnError(error)
}

export const loadHouseholdWorkspace = async (user: User): Promise<HouseholdWorkspace> => {
  const client = getClient()
  const householdId = await ensureHousehold(user)

  const [householdResult, membersResult, permissionsResult, activityResult] = await Promise.all([
    client.from('households').select('id,name,owner_id').eq('id', householdId).single(),
    client.from('household_members').select('id,household_id,user_id,invited_email,display_name,role,status').eq('household_id', householdId).order('created_at'),
    client.from('module_permissions').select('household_id,member_id,module,can_view,can_edit').eq('household_id', householdId),
    client.from('household_activity').select('id,actor_name,action,detail,created_at').eq('household_id', householdId).order('created_at', { ascending: false }).limit(20),
  ])

  throwOnError(householdResult.error)
  throwOnError(membersResult.error)
  throwOnError(permissionsResult.error)
  throwOnError(activityResult.error)

  const household = householdResult.data as HouseholdRow
  const permissionRows = (permissionsResult.data ?? []) as PermissionRow[]
  const members = ((membersResult.data ?? []) as MemberRow[]).map<HouseholdMember>((member) => {
    const email = member.invited_email ?? ''
    const name = member.display_name?.trim() || email.split('@')[0] || 'عضو'
    const permissions = Object.fromEntries(sharedModules.map((module) => {
      const permission = permissionRows.find((row) => row.member_id === member.id && row.module === module)
      return [module, member.role === 'owner' ? 'edit' : toAccessLevel(permission)]
    })) as HouseholdMember['permissions']

    return {
      id: member.id,
      name,
      initials: getInitials(name),
      email,
      role: member.role,
      status: member.status,
      permissions,
    }
  })

  const activity = ((activityResult.data ?? []) as ActivityRow[]).map<HouseholdActivity>((entry) => ({
    id: entry.id,
    actor: entry.actor_name || 'عضو رُشد',
    action: entry.action,
    detail: entry.detail || '',
    time: formatActivityTime(entry.created_at),
    icon: entry.action.includes('دعوة') ? '✉' : entry.action.includes('صلاحية') ? '🔐' : entry.action.includes('شراء') ? '🛒' : '⌂',
  }))

  return {
    id: household.id,
    name: household.name,
    isOwner: household.owner_id === user.id,
    members,
    activity,
  }
}

export const inviteHouseholdMember = async (workspace: HouseholdWorkspace, user: User, emailInput: string) => {
  const client = getClient()
  const email = emailInput.trim().toLowerCase()
  if (!email) throw new Error('اكتب البريد الإلكتروني أولًا.')

  const { data: member, error } = await client
    .from('household_members')
    .insert({
      household_id: workspace.id,
      invited_email: email,
      display_name: email.split('@')[0],
      role: 'member',
      status: 'pending',
    })
    .select('id')
    .single()
  throwOnError(error)

  const memberId = String(member.id)
  const { error: permissionsError } = await client.from('module_permissions').insert([
    { household_id: workspace.id, member_id: memberId, module: 'market', can_view: true, can_edit: true },
    { household_id: workspace.id, member_id: memberId, module: 'wishes', can_view: true, can_edit: false },
    { household_id: workspace.id, member_id: memberId, module: 'noor', can_view: true, can_edit: false },
  ])
  throwOnError(permissionsError)
  await insertActivity(workspace.id, user, 'أرسل دعوة', email)
}

export const updateMemberAccess = async (
  workspace: HouseholdWorkspace,
  user: User,
  member: HouseholdMember,
  module: SharedModule,
  access: AccessLevel,
) => {
  const client = getClient()
  if (!workspace.isOwner) throw new Error('المالك فقط يقدر يعدل الصلاحيات.')
  if (member.role === 'owner') return

  const { error } = await client.from('module_permissions').upsert({
    household_id: workspace.id,
    member_id: member.id,
    module,
    can_view: access !== 'none',
    can_edit: access === 'edit',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'member_id,module' })
  throwOnError(error)
  await insertActivity(workspace.id, user, 'عدّل صلاحية', `${module} لـ ${member.name}: ${access}`)
}

export const subscribeToHousehold = (householdId: string, onChange: () => void): RealtimeChannel | null => {
  if (!supabase) return null
  return supabase
    .channel(`household-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'household_members', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'module_permissions', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'household_activity', filter: `household_id=eq.${householdId}` }, onChange)
    .subscribe()
}

export const loadSharedWorkspaceData = async (user: User): Promise<SharedWorkspaceData> => {
  const client = getClient()
  const householdId = await ensureHousehold(user)
  const [marketResult, wishesResult] = await Promise.all([
    client.from('shared_market_items').select('id,title,quantity,added_by_name,checked').eq('household_id', householdId).order('created_at'),
    client.from('shared_wishes').select('id,title,icon,saved,target,deadline_label,owner_name').eq('household_id', householdId).eq('is_shared', true).order('created_at'),
  ])
  throwOnError(marketResult.error)
  throwOnError(wishesResult.error)

  return {
    householdId,
    marketItems: ((marketResult.data ?? []) as MarketRow[]).map((item) => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity || 'بدون كمية',
      owner: item.added_by_name || 'عضو رُشد',
      checked: item.checked,
    })),
    wishes: ((wishesResult.data ?? []) as WishRow[]).map((wish) => ({
      id: wish.id,
      title: wish.title,
      icon: wish.icon || '♡',
      saved: Number(wish.saved),
      target: Number(wish.target),
      deadline: wish.deadline_label || 'بدون موعد',
      owner: wish.owner_name || 'العائلة',
    })),
  }
}

export const addSharedMarketItem = async (householdId: string, user: User, title: string, quantity: string) => {
  const client = getClient()
  const { error } = await client.from('shared_market_items').insert({
    household_id: householdId,
    title,
    quantity,
    added_by: user.id,
    added_by_name: getUserName(user),
  })
  throwOnError(error)
  await insertActivity(householdId, user, 'أضاف عنصرًا', `${title} إلى السوبرماركت`)
}

export const toggleSharedMarketItem = async (householdId: string, user: User, item: SharedMarketItem) => {
  const client = getClient()
  const { error } = await client.from('shared_market_items').update({
    checked: !item.checked,
    updated_at: new Date().toISOString(),
  }).eq('id', item.id).eq('household_id', householdId)
  throwOnError(error)
  await insertActivity(householdId, user, item.checked ? 'أعاد عنصرًا للقائمة' : 'أكمل شراء', item.title)
}

export const addSharedWish = async (
  householdId: string,
  user: User,
  input: { title: string; icon: string; target: number; deadline: string },
) => {
  const client = getClient()
  const { error } = await client.from('shared_wishes').insert({
    household_id: householdId,
    title: input.title,
    icon: input.icon,
    target: input.target,
    deadline_label: input.deadline,
    owner_id: user.id,
    owner_name: getUserName(user),
    is_shared: true,
  })
  throwOnError(error)
  await insertActivity(householdId, user, 'أضاف أمنية مشتركة', input.title)
}

export const subscribeToSharedData = (householdId: string, onChange: () => void): RealtimeChannel | null => {
  if (!supabase) return null
  return supabase
    .channel(`shared-data-${householdId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_market_items', filter: `household_id=eq.${householdId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_wishes', filter: `household_id=eq.${householdId}` }, onChange)
    .subscribe()
}

export const demoWorkspace: HouseholdWorkspace = {
  id: 'demo-household',
  name: 'بيت حمزة',
  isOwner: true,
  members: initialHouseholdMembers,
  activity: initialHouseholdActivity,
}

export { getUserName, isSupabaseConfigured }
