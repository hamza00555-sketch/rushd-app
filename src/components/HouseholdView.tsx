import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  initialHouseholdActivity,
  initialHouseholdMembers,
  sharedModuleLabels,
  type HouseholdActivity,
  type HouseholdMember,
  type SharedModule,
} from '../lib/household'
import { isSupabaseConfigured } from '../lib/supabase'

export function HouseholdView({ onClose }: { onClose: () => void }) {
  const [members, setMembers] = useState<HouseholdMember[]>(initialHouseholdMembers)
  const [activity, setActivity] = useState<HouseholdActivity[]>(initialHouseholdActivity)
  const [inviteEmail, setInviteEmail] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState('asma')
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? members[1]

  const addActivity = (entry: Omit<HouseholdActivity, 'id' | 'time'>) => {
    setActivity((current) => [{ ...entry, id: Date.now(), time: 'الآن' }, ...current])
  }

  const inviteMember = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email || members.some((member) => member.email === email)) return

    const pending: HouseholdMember = {
      id: `pending-${Date.now()}`,
      name: email.split('@')[0] || 'عضو جديد',
      initials: 'ج',
      email,
      role: 'member',
      status: 'pending',
      permissions: { market: true, wishes: false, noor: false },
    }
    setMembers((current) => [...current, pending])
    setInviteEmail('')
    addActivity({ actor: 'حمزة', action: 'أرسل دعوة', detail: email, icon: '✉' })
  }

  const togglePermission = (module: SharedModule) => {
    if (!selectedMember || selectedMember.role === 'owner') return
    setMembers((current) => current.map((member) => member.id === selectedMember.id ? {
      ...member,
      permissions: { ...member.permissions, [module]: !member.permissions[module] },
    } : member))
    addActivity({
      actor: 'حمزة',
      action: 'عدّل صلاحية',
      detail: `${sharedModuleLabels[module].title} لـ ${selectedMember.name}`,
      icon: '🔐',
    })
  }

  return (
    <motion.section className="household-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="household-sheet" initial={{ y: 70, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 70, scale: .98 }}>
        <header className="household-header">
          <button type="button" onClick={onClose} aria-label="إغلاق">×</button>
          <div><span>المساحة العائلية</span><h1>بيت حمزة</h1><p>أنت المالك. كل عضو يرى فقط الوحدات التي تشاركها معه.</p></div>
          <div className={`sync-chip ${isSupabaseConfigured ? 'connected' : ''}`}><i/>{isSupabaseConfigured ? 'Supabase جاهز' : 'وضع تجريبي'}</div>
        </header>

        <section className="household-card member-card">
          <div className="household-title"><div><span>أعضاء البيت</span><h2>{members.length} أعضاء</h2></div><small>المالك يتحكم بالصلاحيات</small></div>
          <div className="member-list">
            {members.map((member) => (
              <button type="button" className={`member-row ${selectedMemberId === member.id ? 'selected' : ''}`} onClick={() => setSelectedMemberId(member.id)} key={member.id}>
                <span className="member-avatar">{member.initials}</span>
                <span><strong>{member.name}</strong><small>{member.role === 'owner' ? 'المالك' : member.status === 'pending' ? 'الدعوة معلقة' : 'عضو'}</small></span>
                <b className={member.status}>{member.status === 'active' ? 'نشط' : 'بانتظار القبول'}</b>
              </button>
            ))}
          </div>
          <form className="invite-form" onSubmit={inviteMember}>
            <input type="email" placeholder="البريد الإلكتروني للعضو" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} aria-label="البريد الإلكتروني للعضو"/>
            <button type="submit">إرسال دعوة</button>
          </form>
        </section>

        <section className="household-card permissions-card">
          <div className="household-title"><div><span>الصلاحيات</span><h2>وصول {selectedMember?.name}</h2></div><small>{selectedMember?.role === 'owner' ? 'صلاحيات كاملة' : 'تُحدّث فورًا'}</small></div>
          <div className="permission-list">
            {(Object.keys(sharedModuleLabels) as SharedModule[]).map((module) => {
              const definition = sharedModuleLabels[module]
              const enabled = selectedMember?.permissions[module] ?? false
              return (
                <button type="button" className="permission-row" onClick={() => togglePermission(module)} disabled={selectedMember?.role === 'owner'} key={module}>
                  <span className="permission-icon">{definition.icon}</span>
                  <span><strong>{definition.title}</strong><small>{definition.description}</small></span>
                  <i className={`permission-switch ${enabled ? 'enabled' : ''}`}><b/></i>
                </button>
              )
            })}
          </div>
        </section>

        <section className="household-card activity-card">
          <div className="household-title"><div><span>سجل البيت</span><h2>آخر النشاطات</h2></div><small>شفافية بدون كشف بياناتك الخاصة</small></div>
          <div className="activity-list">
            {activity.slice(0, 5).map((entry, index) => (
              <motion.article key={entry.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .05 }}>
                <span>{entry.icon}</span><div><strong>{entry.actor} · {entry.action}</strong><p>{entry.detail}</p></div><small>{entry.time}</small>
              </motion.article>
            ))}
          </div>
        </section>

        {!isSupabaseConfigured && <section className="supabase-blocker"><strong>المتبقي لتفعيل المزامنة الحقيقية</strong><p>أضف <code>VITE_SUPABASE_URL</code> و<code>VITE_SUPABASE_ANON_KEY</code> في Vercel، ثم نفّذ ملف <code>supabase/migrations/001_households.sql</code>.</p></section>}
      </motion.div>
    </motion.section>
  )
}
