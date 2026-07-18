export type SharedModule = 'market' | 'wishes' | 'noor'

export type HouseholdMember = {
  id: string
  name: string
  initials: string
  email: string
  role: 'owner' | 'member'
  status: 'active' | 'pending'
  permissions: Record<SharedModule, boolean>
}

export type HouseholdActivity = {
  id: number
  actor: string
  action: string
  detail: string
  time: string
  icon: string
}

export const sharedModuleLabels: Record<SharedModule, { title: string; description: string; icon: string }> = {
  market: { title: 'السوبرماركت', description: 'إضافة العناصر وتحديث حالة الشراء', icon: '🛒' },
  wishes: { title: 'أماني رُشد', description: 'عرض الأماني المشتركة والمساهمة فيها', icon: '♡' },
  noor: { title: 'احتياجات نور', description: 'متابعة ميزانية ومشتريات نور', icon: '🧸' },
}

export const initialHouseholdMembers: HouseholdMember[] = [
  {
    id: 'hamza',
    name: 'حمزة',
    initials: 'ح',
    email: 'owner@rushd.app',
    role: 'owner',
    status: 'active',
    permissions: { market: true, wishes: true, noor: true },
  },
  {
    id: 'asma',
    name: 'أسماء',
    initials: 'أ',
    email: 'asma@rushd.app',
    role: 'member',
    status: 'active',
    permissions: { market: true, wishes: true, noor: true },
  },
]

export const initialHouseholdActivity: HouseholdActivity[] = [
  { id: 1, actor: 'أسماء', action: 'أضافت عنصرًا', detail: 'حليب إلى قائمة السوبرماركت', time: 'منذ 8 دقائق', icon: '🛒' },
  { id: 2, actor: 'حمزة', action: 'عدّل صلاحية', detail: 'فعّل الوصول إلى أماني رُشد', time: 'اليوم، 10:42 م', icon: '🔐' },
  { id: 3, actor: 'أسماء', action: 'أكملت شراء', detail: 'مناديل المطبخ', time: 'أمس', icon: '✓' },
]
