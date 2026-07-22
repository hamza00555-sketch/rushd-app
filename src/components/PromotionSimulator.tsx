import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { User } from 'firebase/auth'
import { RushdCharacter } from './RushdCharacter'
import { formatSar } from '../lib/finance'
import {
  buildPromotionSimulation,
  buildSalaryOptions,
  describePromotion,
  promotionProfiles,
  type PromotionProfileId,
  type SavedPromotionScenario,
} from '../lib/promotionEngine'
import {
  deletePromotionScenario,
  loadPromotionScenarios,
  savePromotionScenario,
} from '../lib/promotionRepository'
import { getCurrentMonthKey, loadMonthlyPlanOnce } from '../lib/monthlyPlanRepository'
import { getFirebaseErrorMessage } from '../lib/firebaseErrors'
import { useDialog } from '../hooks/useDialog'

export function PromotionSimulator({ onClose, user }: { onClose: () => void; user: User }) {
  const [currentSalary, setCurrentSalary] = useState('')
  const [newSalary, setNewSalary] = useState('')
  const [profileId, setProfileId] = useState<PromotionProfileId>('balanced')
  const [savedScenarios, setSavedScenarios] = useState<SavedPromotionScenario[]>([])
  const [scenarioName, setScenarioName] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('اختَر نسبة أو اكتب الراتب الجديد، وأنا أوزع الزيادة بدون تضخم عشوائي.')
  const [error, setError] = useState('')
  const [cloudReady, setCloudReady] = useState(false)
  const dialogRef = useDialog<HTMLDivElement>(onClose, !saveOpen)
  const saveDialogRef = useDialog<HTMLFormElement>(() => setSaveOpen(false), saveOpen)

  const currentValue = Number(currentSalary) || 0
  const newValue = Number(newSalary) || 0
  const simulation = useMemo(
    () => buildPromotionSimulation(currentValue, newValue, profileId),
    [currentValue, newValue, profileId],
  )
  const salaryOptions = useMemo(() => buildSalaryOptions(currentValue), [currentValue])

  useEffect(() => {
    let active = true
    void Promise.all([
      loadPromotionScenarios(user.uid),
      loadMonthlyPlanOnce(user.uid, getCurrentMonthKey()),
    ])
      .then(([scenarios, monthlyPlan]) => {
        if (!active) return
        setSavedScenarios(scenarios)
        if (monthlyPlan?.salary) {
          setCurrentSalary(String(monthlyPlan.salary))
          setNewSalary(String(Math.round(monthlyPlan.salary * 1.2)))
        }
        setCloudReady(true)
      })
      .catch((cause: unknown) => {
        if (active) setError(getFirebaseErrorMessage(cause, 'تعذر تحميل السيناريوهات المحفوظة.'))
      })

    return () => { active = false }
  }, [user.uid])

  useEffect(() => {
    setMessage(describePromotion(simulation))
  }, [simulation])

  const chooseRate = (rate: number, salary: number) => {
    setNewSalary(String(salary))
    setMessage(`تم تطبيق زيادة ${rate}%. الآن اختَر طريقة توزيعها.`)
  }

  const openSave = () => {
    if (simulation.increase <= 0) {
      setError('الراتب الجديد لازم يكون أعلى من الراتب الحالي.')
      return
    }
    setScenarioName(`ترقية ${simulation.increaseRate}% — ${simulation.profile.title}`)
    setSaveOpen(true)
    setError('')
  }

  const saveScenario = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = scenarioName.trim()
    if (name.length < 2) {
      setError('اكتب اسمًا من حرفين على الأقل للسيناريو.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const input = {
        name,
        currentSalary: simulation.currentSalary,
        newSalary: simulation.newSalary,
        profileId,
        increase: simulation.increase,
        increaseRate: simulation.increaseRate,
      }

      const saved = await savePromotionScenario(user.uid, input)
      setSavedScenarios((current) => [saved, ...current])
      setCloudReady(true)
      setMessage('حفظت السيناريو في حسابك الخاص. لا يظهر لأي عضو في العائلة.')
      setSaveOpen(false)
    } catch (cause: unknown) {
      setError(getFirebaseErrorMessage(cause, 'تعذر حفظ السيناريو.'))
    } finally {
      setBusy(false)
    }
  }

  const applyScenario = (scenario: SavedPromotionScenario) => {
    setCurrentSalary(String(scenario.currentSalary))
    setNewSalary(String(scenario.newSalary))
    setProfileId(scenario.profileId)
    setMessage(`فتحت سيناريو: ${scenario.name}`)
  }

  const removeScenario = async (scenario: SavedPromotionScenario) => {
    setBusy(true)
    setError('')
    try {
      await deletePromotionScenario(user.uid, scenario.id)
      setSavedScenarios((current) => current.filter((item) => item.id !== scenario.id))
    } catch (cause: unknown) {
      setError(getFirebaseErrorMessage(cause, 'تعذر حذف السيناريو.'))
    } finally {
      setBusy(false)
    }
  }

  const maxAfter = Math.max(...simulation.buckets.map((bucket) => bucket.after), 1)

  return (
    <motion.section className="promotion-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <motion.div ref={dialogRef} className="promotion-sheet" role="dialog" aria-modal="true" aria-labelledby="promotion-title" tabIndex={-1} initial={{ y: 70, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 70, scale: .98 }}>
        <button type="button" className="module-close-sticky" onClick={onClose} aria-label="إغلاق محاكي الترقية">×</button>
        <header className="promotion-header">
          <div className="promotion-title-copy">
            <span>محاكي الترقية</span>
            <h1 id="promotion-title">لا تخلي الزيادة تختفي.</h1>
            <p>قارن الراتب قبل وبعد، ثم وجّه كل ريال من الزيادة قبل ما يتحول إلى مصروف عادي.</p>
          </div>
          <div className="promotion-character"><RushdCharacter mood="thinking" size="sm" message={message}/></div>
        </header>

        {error && <div className="promotion-message error">{error}</div>}

        <section className="promotion-card salary-input-card">
          <div className="promotion-section-title"><div><span>01</span><h2>حدد الراتبين</h2></div><small>الحساب لحظي</small></div>
          <div className="salary-compare-inputs">
            <label><small>راتبك الحالي</small><div><input inputMode="decimal" value={currentSalary} onChange={(event) => setCurrentSalary(event.target.value)} aria-label="الراتب الحالي"/><b>ريال</b></div></label>
            <span className="salary-arrow">←</span>
            <label><small>الراتب الجديد</small><div><input inputMode="decimal" value={newSalary} onChange={(event) => setNewSalary(event.target.value)} aria-label="الراتب الجديد"/><b>ريال</b></div></label>
          </div>
          <div className="raise-options">
            {salaryOptions.map((option) => (
              <button type="button" className={Math.round(simulation.increaseRate) === option.rate ? 'active' : ''} onClick={() => chooseRate(option.rate, option.salary)} key={option.rate}>
                <strong>+{option.rate}%</strong><small>{formatSar(option.salary)} ريال</small>
              </button>
            ))}
          </div>
        </section>

        <section className="promotion-summary-grid">
          <article className="raise-primary"><span>الزيادة الشهرية</span><strong>+{formatSar(simulation.increase)}</strong><small>{simulation.increaseRate}% فوق راتبك الحالي</small></article>
          <article><span>الزيادة السنوية</span><strong>{formatSar(simulation.annualIncrease)}</strong><small>قبل المكافآت</small></article>
          <article><span>للمستقبل والأهداف</span><strong>{simulation.protectedRate}%</strong><small>{formatSar(simulation.futureAdded)} ريال شهريًا</small></article>
        </section>

        <section className="promotion-card profile-card">
          <div className="promotion-section-title"><div><span>02</span><h2>اختَر فلسفة الزيادة</h2></div><small>يمكنك المقارنة فورًا</small></div>
          <div className="profile-options">
            {promotionProfiles.map((profile) => (
              <button type="button" className={profileId === profile.id ? 'active' : ''} onClick={() => setProfileId(profile.id)} key={profile.id}>
                <span>{profile.icon}</span><div><small>{profile.subtitle}</small><strong>{profile.title}</strong><p>{profile.description}</p></div><i>{profileId === profile.id ? '✓' : ''}</i>
              </button>
            ))}
          </div>
        </section>

        <section className="promotion-card distribution-card">
          <div className="promotion-section-title"><div><span>03</span><h2>أين تذهب الزيادة؟</h2></div><small>{simulation.profile.title}</small></div>
          <div className="distribution-list">
            {simulation.buckets.map((bucket, index) => (
              <motion.article key={bucket.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }}>
                <span className={`promotion-bucket-icon ${bucket.tone}`}>{bucket.icon}</span>
                <div className="promotion-bucket-copy">
                  <div><strong>{bucket.title}</strong><small>{bucket.raiseShare}% من الزيادة</small></div>
                  <div className="before-after-values"><span>{formatSar(bucket.before)}</span><b>+{formatSar(bucket.added)}</b><strong>{formatSar(bucket.after)}</strong></div>
                  <div className="comparison-track"><i style={{ width: `${Math.max(4, (bucket.before / maxAfter) * 100)}%` }}/><b style={{ width: `${Math.max(2, (bucket.added / maxAfter) * 100)}%` }}/></div>
                </div>
              </motion.article>
            ))}
          </div>
          <div className="comparison-legend"><span><i/>قبل</span><span><b/>الزيادة</span><small>الأرقام الشهرية بالريال</small></div>
        </section>

        <section className="promotion-decision-card">
          <div><span>قرار رُشد</span><h2>{describePromotion(simulation)}</h2><p>جودة الحياة تزيد بـ {formatSar(simulation.lifestyleAdded)} ريال، بينما يذهب {formatSar(simulation.futureAdded)} ريال للمستقبل والأهداف.</p></div>
          <button type="button" onClick={openSave}>حفظ هذا السيناريو</button>
        </section>

        <section className="promotion-card saved-scenarios-card">
          <div className="promotion-section-title"><div><span>04</span><h2>السيناريوهات المحفوظة</h2></div><small>{cloudReady ? 'خاصة ومتزامنة' : 'جاري التحميل'}</small></div>
          {savedScenarios.length === 0 ? (
            <div className="promotion-empty"><span>◎</span><strong>ما حفظت أي سيناريو بعد</strong><p>احفظ أكثر من عرض وظيفي وقارن بينهم بدون ما تعيد الحساب.</p></div>
          ) : (
            <div className="saved-scenarios-list">
              {savedScenarios.map((scenario) => (
                <article key={scenario.id}>
                  <button type="button" className="saved-scenario-main" onClick={() => applyScenario(scenario)}>
                    <span>↗</span><div><strong>{scenario.name}</strong><small>{formatSar(scenario.currentSalary)} ← {formatSar(scenario.newSalary)} ريال</small></div><b>+{scenario.increaseRate}%</b>
                  </button>
                  <button type="button" className="delete-scenario" onClick={() => void removeScenario(scenario)} disabled={busy} aria-label={`حذف ${scenario.name}`}>×</button>
                </article>
              ))}
            </div>
          )}
        </section>

        <AnimatePresence>
          {saveOpen && (
            <motion.div className="save-scenario-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSaveOpen(false)}>
              <motion.form ref={saveDialogRef} className="save-scenario-dialog" role="dialog" aria-modal="true" aria-labelledby="save-scenario-title" initial={{ y: 30, scale: .96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, scale: .96 }} onSubmit={saveScenario} onClick={(event) => event.stopPropagation()}>
                <span>حفظ السيناريو</span><h2 id="save-scenario-title">سمّه عشان ترجع له بسهولة</h2>
                <input data-autofocus value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} aria-label="اسم السيناريو"/>
                {error && <div className="inline-form-error" role="alert">{error}</div>}
                <div><button type="button" onClick={() => setSaveOpen(false)}>إلغاء</button><button type="submit" disabled={busy}>{busy ? 'جاري الحفظ…' : 'حفظ'}</button></div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  )
}
