import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import type { User } from 'firebase/auth'
import {
  accessLabels,
  nextAccessLevel,
  sharedModuleLabels,
  sharedModules,
  type HouseholdWorkspace,
  type SharedModule,
} from '../lib/household'
import {
  inviteHouseholdMember,
  loadHouseholdWorkspace,
  subscribeToHousehold,
  updateMemberAccess,
} from '../lib/householdRepository'
import { getFirebaseErrorMessage } from '../lib/firebaseErrors'
import { useDialog } from '../hooks/useDialog'

export function HouseholdView({ onClose, user }: { onClose: () => void; user: User }) {
  const [workspace, setWorkspace] = useState<HouseholdWorkspace | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dialogRef = useDialog<HTMLDivElement>(onClose)

  const selectedMember = useMemo(() => {
    if (!workspace) return null
    return workspace.members.find((member) => member.id === selectedMemberId)
      ?? workspace.members.find((member) => member.role !== 'owner')
      ?? workspace.members[0]
  }, [selectedMemberId, workspace])

  const reloadWorkspace = async () => {
    const next = await loadHouseholdWorkspace(user)
    setWorkspace(next)
    setSelectedMemberId((current) => next.members.some((member) => member.id === current)
      ? current
      : next.members.find((member) => member.role !== 'owner')?.id ?? next.members[0]?.id ?? '')
    return next
  }

  useEffect(() => {
    let active = true
    setBusy(true)
    void reloadWorkspace()
      .catch((cause: unknown) => {
        if (active) setError(getFirebaseErrorMessage(cause, 'تعذر تحميل مساحة العائلة.'))
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => { active = false }
  }, [user.uid])

  useEffect(() => {
    if (!workspace) return
    return subscribeToHousehold(workspace.id, () => {
      void reloadWorkspace().catch((cause: unknown) => setError(getFirebaseErrorMessage(cause, 'تعذر تحديث مساحة العائلة.')))
    })
  }, [workspace?.id, user.uid])

  const inviteMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!workspace || !inviteEmail.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await inviteHouseholdMember(workspace, user, inviteEmail)
      await reloadWorkspace()
      setInviteEmail('')
      setNotice('تم تسجيل الدعوة. ينضم العضو تلقائيًا عند إنشاء حساب بنفس البريد.')
    } catch (cause: unknown) {
      setError(getFirebaseErrorMessage(cause, 'تعذر إرسال الدعوة.'))
    } finally {
      setBusy(false)
    }
  }

  const cyclePermission = async (module: SharedModule) => {
    if (!workspace || !selectedMember || selectedMember.role === 'owner' || !workspace.isOwner) return
    setBusy(true)
    setError('')
    try {
      await updateMemberAccess(workspace, user, selectedMember, module, nextAccessLevel(selectedMember.permissions[module]))
      await reloadWorkspace()
    } catch (cause: unknown) {
      setError(getFirebaseErrorMessage(cause, 'تعذر تعديل الصلاحية.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.section
      className="household-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <motion.div
        ref={dialogRef}
        className="household-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="household-title"
        tabIndex={-1}
        initial={{ y: 70, scale: .98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 70, scale: .98 }}
      >
        <button type="button" className="module-close-sticky" onClick={onClose} aria-label="إغلاق مساحة العائلة">×</button>
        <header className="household-header">
          <div><span>المساحة العائلية</span><h1 id="household-title">{workspace?.name ?? 'رُشد للعائلة'}</h1><p>الحساب المالي الكامل خاص بك. المشاركة تقتصر على الوحدات التي تمنحها لكل عضو.</p></div>
          <div className={`sync-chip ${workspace ? 'connected' : ''}`}><i/>{workspace ? 'متصل لحظيًا بـ Firebase' : 'جاري الاتصال'}</div>
        </header>

        {busy && !workspace && <section className="household-card loading-card"><span className="live-dot"/><strong>جاري تجهيز مساحة البيت…</strong></section>}
        {error && <div className="household-message error-message" role="alert">{error}</div>}
        {notice && <div className="household-message notice-message" role="status">{notice}</div>}

        {workspace && (
          <>
            <section className="household-card member-card">
              <div className="household-title"><div><span>أعضاء البيت</span><h2>{workspace.members.length} أعضاء</h2></div><small>{workspace.isOwner ? 'أنت تتحكم بالصلاحيات' : 'تظهر لك صلاحيات حسابك فقط'}</small></div>
              <div className="member-list">
                {workspace.members.map((member) => (
                  <button type="button" className={`member-row ${selectedMember?.id === member.id ? 'selected' : ''}`} onClick={() => setSelectedMemberId(member.id)} key={member.id}>
                    <span className="member-avatar">{member.initials}</span>
                    <span><strong>{member.name}</strong><small>{member.role === 'owner' ? 'المالك' : member.status === 'pending' ? member.email : 'عضو'}</small></span>
                    <b className={member.status}>{member.status === 'active' ? 'نشط' : 'بانتظار القبول'}</b>
                  </button>
                ))}
              </div>
              {workspace.isOwner && (
                <form className="invite-form" onSubmit={inviteMember}>
                  <input type="email" inputMode="email" autoCapitalize="none" placeholder="البريد الإلكتروني للعضو" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} aria-label="البريد الإلكتروني للعضو"/>
                  <button type="submit" disabled={busy}>إرسال دعوة</button>
                </form>
              )}
            </section>

            {selectedMember && (
              <section className="household-card permissions-card">
                <div className="household-title"><div><span>الصلاحيات</span><h2>وصول {selectedMember.name}</h2></div><small>{selectedMember.role === 'owner' ? 'صلاحيات كاملة' : workspace.isOwner ? 'اضغط لتغيير المستوى' : 'للقراءة فقط'}</small></div>
                <div className="permission-list">
                  {sharedModules.map((module) => {
                    const definition = sharedModuleLabels[module]
                    const access = selectedMember.permissions[module]
                    return (
                      <button type="button" className="permission-row" onClick={() => void cyclePermission(module)} disabled={busy || selectedMember.role === 'owner' || !workspace.isOwner} key={module}>
                        <span className="permission-icon">{definition.icon}</span>
                        <span><strong>{definition.title}</strong><small>{definition.description}</small></span>
                        <i className={`access-pill access-${access}`}>{accessLabels[access]}</i>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            <section className="household-card activity-card">
              <div className="household-title"><div><span>سجل البيت</span><h2>آخر النشاطات</h2></div><small>بدون كشف بياناتك المالية الخاصة</small></div>
              <div className="activity-list">
                {workspace.activity.length === 0 && <div className="empty-household-state">لا يوجد نشاط مشترك حتى الآن.</div>}
                {workspace.activity.slice(0, 7).map((entry, index) => (
                  <motion.article key={entry.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .05 }}>
                    <span>{entry.icon}</span><div><strong>{entry.actor} · {entry.action}</strong><p>{entry.detail}</p></div><small>{entry.time}</small>
                  </motion.article>
                ))}
              </div>
            </section>
          </>
        )}
      </motion.div>
    </motion.section>
  )
}
