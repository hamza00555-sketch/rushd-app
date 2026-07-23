export type SharedModule = 'market' | 'wishes' | 'noor'
export type AccessLevel = 'none' | 'view' | 'edit'

export type HouseholdMember = {
  id: string
  name: string
  initials: string
  email: string
  role: 'owner' | 'member'
  status: 'active' | 'pending'
  permissions: Record<SharedModule, AccessLevel>
}

export type HouseholdActivity = {
  id: string | number
  actor: string
  action: string
  detail: string
  time: string
  icon: string
}

export type HouseholdWorkspace = {
  id: string
  name: string
  isOwner: boolean
  members: HouseholdMember[]
  activity: HouseholdActivity[]
}

export const sharedModules: SharedModule[] = ['market', 'wishes', 'noor']

export const sharedModuleLabels: Record<SharedModule, { title: string; description: string; icon: string }> = {
  market: { title: 'السوبرماركت', description: 'إضافة العناصر وتحديث حالة الشراء', icon: '🛒' },
  wishes: { title: 'أماني رُشد', description: 'عرض الأماني المشتركة والمساهمة فيها', icon: '♡' },
  noor: { title: 'احتياجات نور', description: 'متابعة ميزانية ومشتريات نور', icon: '🧸' },
}

export const accessLabels: Record<AccessLevel, string> = {
  none: 'خاص',
  view: 'عرض فقط',
  edit: 'عرض وتعديل',
}

export const nextAccessLevel = (current: AccessLevel): AccessLevel => {
  if (current === 'none') return 'view'
  if (current === 'view') return 'edit'
  return 'none'
}
