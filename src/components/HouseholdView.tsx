import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { onAuthStateChanged, type User } from 'firebase/auth'
import {
  accessLabels,
  nextAccessLevel,
  sharedModuleLabels,
  sharedModules,
  type HouseholdWorkspace,
  type SharedModule,
} from '../lib/household'
import {
  demoWorkspace,
  inviteHouseholdMember,
  isFirebaseConfigured,
  loadHouseholdWorkspace,
  signInToRushd,
  signOutFromRushd,
  signUpToRushd,
  subscribeToHousehold,
  updateMemberAccess,
} from '../lib/householdRepository'
import { auth } from '../lib/firebase'

export function HouseholdView({ onClose }: { onClose: () => void }) {
  const [workspace, setWorkspace] = useState<HouseholdWorkspace | null>(isFirebaseConfigured ? null : demoWorkspace)
  const [user, setUser] = useState<User | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(isFirebaseConfigured)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selectedMember = useMemo(() => {
    if (!workspace) return null
    return workspace.members.find((member) => member.id === selectedMemberId)
      ?? workspace.members.find((member) => member.role !== 'owner')
      ?? workspace.members[0]
  }, [selectedMemberId, workspace])

  const reloadWorkspace = async (activeUser: User) => {
    const next = await loadHouseholdWorkspace(activeUser)
    setWorkspace(next)
    setSelectedMemberId((current) => next.members.some((member) => member.id === current)
      ? current
      : next.members.find((member) => member.role !== 'owner')?.id ?? next.members[0]?.id ?? '')
  }

  useEffect(() => {
    if (!isFirebaseConfigured) return
    let active = true
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return
      setUser(nextUser)
      setWorkspace(null)
      setError('')
      setNotice('')
      setBusy(false)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    setBusy(true)
    void reloadWorkspace(user)
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'تعذر تحميل مساحة العائلة.')
      })
      .finally(() => {
        if (active) setBusy(false)
      })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!user || !workspace || !isFirebaseConfigured) return
    const unsubscribe = subscribeToHousehold(workspace.id, () => {
      void reloadWorkspace(user).catch(() => undefined)
    })
    return unsubscribe
  }, [user?.uid, workspace?.id])

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!email.trim() || password.length < 6) {
      setError('اكتب بريدًا صحيحًا وكلمة مرور من 6 أحرف على الأقل.')
      return
    }

    setBusy(true)
    try {
      const signedUser = authMode === 'signin'
        ? await signInToRushd(email.trim().toLowerCase(), password)
        : await signUpToRushd(name, email.trim().toLowerCase(), password)
      setUser(signedUser)
      setNotice(authMode === 'signup' ? 'تم إنشاء الحساب وتجهيز مساحة رُشد.' : '')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'تعذرت المصادقة.')
    } finally {
      setBusy(false)
    }
  }

  const inviteMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!workspace || !inviteEmail.trim()) return
    setBusy(true)
    setError('')
    try {
      if (!isFirebaseConfigured) {
        const normalized = inviteEmail.trim().toLowerCase()
        if (workspace.members.some((member) => member.email === normalized)) return
        setWorkspace({
          ...workspace,
          members: [...workspace.members, {
            id: `pending-${Date.now()}`,
            name: normalized.split('@')[0],
            initials: 'ج',
            email: normalized,
            role: 'member',
            status: 'pending',
            permissions: { market: 'edit', wishes: 'view', noor: 'view' },
          }],
          activity: [{ id: Date.now(), actor: 'حمزة', action: 'أرسل دعوة', detail: normalized, time: 'الآن', icon: '✉' }, ...workspace.activity],
        })
      } else if (user) {
        await inviteHouseholdMember(workspace, user, inviteEmail)
        await reloadWorkspace(user)
      }
      setInviteEmail('')
      setNotice('تم تسجيل الدعوة. عند إنشاء العضو حسابًا بنفس البريد ينضم تلقائيًا للبيت.')
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'تعذر إرسال الدعوة.')
    } finally {
      setBusy(false)
    }
  }

  const cyclePermission = async (module: SharedModule) => {
    if (!workspace || !selectedMember || selectedMember.role === 'owner' || !workspace.isOwner) return
    const next = nextAccessLevel(selectedMember.permissions[module])
    setError('')
    try {
      if (!isFirebaseConfigured) {
        setWorkspace({
          ...workspace,
          members: workspace.members.map((member) => member.id === selectedMember.id
            ? { ...member, permissions: { ...member.permissions, [module]: next } }
            : member),
          activity: [{ id: Date.now(), actor: 'حمزة', action: 'عدّل صلاحية', detail: `${sharedModuleLabels[module].title} لـ ${selectedMember.name}: ${accessLabels[next]}`, time: 'الآن', icon: '🔐' }, ...workspace.activity],
        })
      } else if (user) {
        await updateMemberAccess(workspace, user, selectedMember, module, next)
        await reloadWorkspace(user)
      }
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'تعذر تعديل الصلاحية.')
    }
  }

  const logout = async () => {
    setBusy(true)
    try {
      await signOutFromRushd()
      setUser(null)
      setWorkspace(null)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'تعذر تسجيل الخروج.')
    } finally {
      setBusy(false)
    }
  }

  const syncLabel = !isFirebaseConfigured ? 'معاينة بدون خادم' : user && workspace ? 'متصل لحظيًا بـ Firebase' : 'بانتظار تسجيل الدخول'

  return (
    <motion.section className="household-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="household-sheet" initial={{ y: 70, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 70, scale: .98 }}>
        <header className="household-header">
          <button type="button" onClick={onClose} aria-label="إغلاق">×</button>
          <div><span>المساحة العائلية</span><h1>{workspace?.name ?? 'رُشد للعائلة'}</h1><p>الحساب المالي الكامل خاص بالمالك. المشاركة تقتصر على الوحدات التي يمنحها لكل عضو.</p></div>
          <div className={`sync-chip ${user && workspace ? 'connected' : ''}`}><i/>{syncLabel}</div>
          {user && <button type="button" className="signout-button" onClick={logout} disabled={busy}>خروج</button>}
        </header>

        {isFirebaseConfigured && !user && (
          <section className="household-card auth-card">
            <div className="auth-tabs">
              <button type="button" className={authMode === 'signin' ? 'active' : ''} onClick={() => setAuthMode('signin')}>تسجيل الدخول</button>
              <button type="button" className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>حساب جديد</button>
            </div>
            <div className="household-title"><div><span>حساب مستقل لكل عضو</span><h2>{authMode === 'signin' ? 'ادخل إلى بيتك' : 'أنشئ حساب رُشد'}</h2></div><small>البريد وكلمة المرور</small></div>
            <form className="auth-form" onSubmit={submitAuth}>
              {authMode === 'signup' && <input placeholder="الاسم" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name"/>}
              <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email"/>
              <input type="password" placeholder="كلمة المرور" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}/>
              <button type="submit" disabled={busy}>{busy ? 'جاري الاتصال…' : authMode === 'signin' ? 'دخول' : 'إنشاء الحساب'}</button>
            </form>
          </section>
        )}

        {busy && !workspace && <section className="household-card loading-card"><span className="live-dot"/><strong>جاري تجهيز مساحة البيت…</strong></section>}
        {error && <div className="household-message error-message">{error}</div>}
        {notice && <div className="household-message notice-message">{notice}</div>}

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
                  <input type="email" placeholder="البريد الإلكتروني للعضو" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} aria-label="البريد الإلكتروني للعضو"/>
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
                      <button type="button" className="permission-row" onClick={() => cyclePermission(module)} disabled={selectedMember.role === 'owner' || !workspace.isOwner} key={module}>
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
              <div className="household-title"><div><span>سجل البيت</span><h2>آخر النشاطات</h2></div><small>بدون كشف حسابك المالي الخاص</small></div>
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

        {!isFirebaseConfigured && <section className="supabase-blocker"><strong>المعاينة تعمل، لكن Firebase غير مفعّل</strong><p>راجع إعدادات مشروع Firebase ثم أعد تحميل التطبيق.</p></section>}
      </motion.div>
    </motion.section>
  )
}
