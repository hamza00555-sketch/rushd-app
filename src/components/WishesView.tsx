import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from './Icon'
import { useDialog } from '../hooks/useDialog'
import type { SharedSyncStatus } from '../hooks/useSharedModules'
import { formatSar, getSpentPercentage } from '../lib/finance'
import type { AccessLevel } from '../lib/household'
import type {
  SharedWish,
  SharedWishesBudget,
} from '../lib/householdRepository'
import { formatMonthLabel } from '../lib/monthlyPlanRepository'
import {
  getWishCompletionForecast,
  getWishFundingCapacityError,
  getWishFundingLevel,
  WISH_FUNDING_LEVELS,
  type WishFundingLevel,
} from '../lib/wishesFund'

type WishesViewProps = {
  wishes: SharedWish[]
  monthKey: string
  setMonthKey: (monthKey: string) => void
  budget: SharedWishesBudget | null
  reserveBalance: number
  onSaveBudget: (amount: number) => Promise<void>
  canManageBudget: boolean
  onAdd: (input: {
    title: string
    icon: string
    target: number
    deadline: string
    fundingLevel: WishFundingLevel
  }) => Promise<void>
  onUpdateFunding: (wishId: string, fundingLevel: WishFundingLevel) => Promise<void>
  onReset: (wishId: string) => Promise<number>
  access: AccessLevel
  syncStatus: SharedSyncStatus
  syncError: string
}

const parseCurrencyInput = (input: string) => {
  const normalized = input
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.')
  return Number(normalized)
}

const formatMarketSar = (value: number) =>
  new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 }).format(value)

const syncMessage = (status: SharedSyncStatus, error: string) => {
  if (status === 'synced') return { title: 'متصل لحظيًا', body: 'أي تعديل يظهر لأعضاء البيت مباشرة.' }
  if (status === 'connecting') return { title: 'جاري المزامنة', body: 'رُشد يحمّل آخر تحديثات البيت.' }
  return { title: 'تعذر التحديث', body: error || 'تحقق من الاتصال وحاول مرة ثانية.' }
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="goal-track" aria-label={`التقدم ${value}%`}>
      <motion.i initial={{ width: 0 }} animate={{ width: `${Math.min(100, value)}%` }} transition={{ duration: 0.45 }} />
    </div>
  )
}

export function WishesView({
  wishes,
  monthKey,
  setMonthKey,
  budget,
  reserveBalance,
  onSaveBudget,
  canManageBudget,
  onAdd,
  onUpdateFunding,
  onReset,
  access,
  syncStatus,
  syncError,
}: WishesViewProps) {
  const sync = syncMessage(syncStatus, syncError)
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [fundingLevel, setFundingLevel] = useState<WishFundingLevel>('calm')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [budgetFormOpen, setBudgetFormOpen] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState('')
  const [budgetBusy, setBudgetBusy] = useState(false)
  const [budgetError, setBudgetError] = useState('')
  const [selectedWishId, setSelectedWishId] = useState<string | null>(null)
  const [fundingDraft, setFundingDraft] = useState<WishFundingLevel>('calm')
  const [detailsBusy, setDetailsBusy] = useState(false)
  const [detailsError, setDetailsError] = useState('')
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const selectedWish = wishes.find((wish) => wish.id === selectedWishId) ?? null
  const detailsRef = useDialog<HTMLElement>(() => setSelectedWishId(null), Boolean(selectedWish))
  const portfolio = useMemo(
    () => wishes.map((wish) => ({ id: wish.id, fundingLevel: wish.fundingLevel })),
    [wishes],
  )
  const activeShareTotal = useMemo(
    () => wishes
      .filter((wish) => wish.saved < wish.target && wish.fundingLevel !== 'paused')
      .reduce((total, wish) => total + wish.fundingShare, 0),
    [wishes],
  )
  const distributedProgress = budget
    ? getSpentPercentage(budget.allocatedAmount, budget.amount)
    : 0
  const effectiveShare = (wish: SharedWish) => (
    wish.fundingLevel === 'paused'
      ? 0
      : wish.fundingShare * (activeShareTotal > 100 ? 100 / activeShareTotal : 1)
  )

  useEffect(() => {
    setBudgetDraft('')
    setBudgetFormOpen(false)
    setBudgetError('')
  }, [budget?.amount, canManageBudget, monthKey])

  useEffect(() => {
    if (!selectedWish) return
    setFundingDraft(selectedWish.fundingLevel)
    setDetailsError('')
    setResetConfirmOpen(false)
  }, [selectedWish])

  const submitBudget = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = parseCurrencyInput(budgetDraft)
    if (!Number.isFinite(amount) || amount <= 0) {
      setBudgetError('اكتب مبلغ الدفعة التي أضفتها لصندوق الأماني.')
      return
    }
    setBudgetBusy(true)
    setBudgetError('')
    try {
      await onSaveBudget(amount)
      setBudgetDraft('')
      setBudgetFormOpen(false)
    } catch (cause: unknown) {
      setBudgetError(cause instanceof Error ? cause.message : 'تعذر حفظ دفعة صندوق الأماني.')
    } finally {
      setBudgetBusy(false)
    }
  }

  const submitWish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const amount = parseCurrencyInput(target)
    if (!title.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('اكتب اسم الأمنية والمبلغ المستهدف.')
      return
    }
    const capacityError = getWishFundingCapacityError(portfolio, '__new__', fundingLevel)
    if (capacityError) {
      setError(capacityError)
      return
    }
    setBusy(true)
    setError('')
    try {
      await onAdd({
        title: title.trim(),
        icon: '♡',
        target: amount,
        deadline: deadline.trim() || 'بدون موعد',
        fundingLevel,
      })
      setTitle('')
      setTarget('')
      setDeadline('')
      setFundingLevel('calm')
      setFormOpen(false)
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'تعذرت إضافة الأمنية.')
    } finally {
      setBusy(false)
    }
  }

  const openWishDetails = (wish: SharedWish) => {
    setSelectedWishId(wish.id)
    setFundingDraft(wish.fundingLevel)
    setDetailsError('')
    setResetConfirmOpen(false)
  }

  const submitFundingLevel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedWish) return
    const capacityError = getWishFundingCapacityError(portfolio, selectedWish.id, fundingDraft)
    if (capacityError) {
      setDetailsError(capacityError)
      return
    }
    setDetailsBusy(true)
    setDetailsError('')
    try {
      await onUpdateFunding(selectedWish.id, fundingDraft)
    } catch (cause: unknown) {
      setDetailsError(cause instanceof Error ? cause.message : 'تعذر تعديل سرعة الأمنية.')
    } finally {
      setDetailsBusy(false)
    }
  }

  const resetWish = async () => {
    if (!selectedWish) return
    setDetailsBusy(true)
    setDetailsError('')
    try {
      await onReset(selectedWish.id)
      setResetConfirmOpen(false)
      setSelectedWishId(null)
    } catch (cause: unknown) {
      setDetailsError(cause instanceof Error ? cause.message : 'تعذر تصفير رصيد الأمنية.')
    } finally {
      setDetailsBusy(false)
    }
  }

  const openAddForm = () => {
    const calmError = getWishFundingCapacityError(portfolio, '__new__', 'calm')
    setFundingLevel(calmError ? 'paused' : 'calm')
    setError('')
    setFormOpen(true)
  }

  return (
    <motion.main className="screen-content" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
      <section className="goal-intro wishes-intro">
        <img
          className="generated-scene module-scene wishes-scene"
          src="/brand/rushd-wishes-scene.webp"
          alt=""
          width="1200"
          height="800"
          loading="lazy"
          decoding="async"
          draggable="false"
        />
        <span className="illustrated-scene-shade" aria-hidden="true" />
        <div className="illustrated-intro-copy">
          <span>صندوق أماني رُشد</span>
          <h1>ثلاث أماني نشطة، وكل واحدة تتقدم بالسرعة المناسبة.</h1>
          <p>أساسية أو متوسطة أو هادئة؛ والمعلّقة تحتفظ بكل ريال وصلها إلى أن تعيدوها.</p>
        </div>
      </section>

      {access !== 'none' && (
        <section className="wish-monthly-budget">
          <div className="wish-budget-month-row">
            <div>
              <span>دفعات صندوق الأماني</span>
              <small>{formatMonthLabel(monthKey)} · مستقلة عن راتبي</small>
            </div>
            <input type="month" lang="ar" dir="rtl" value={monthKey} onChange={(event) => event.target.value && setMonthKey(event.target.value)} aria-label="شهر صندوق الأماني" />
          </div>

          {budget ? (
            <div className="wish-budget-value">
              <span>إجمالي ما أضيف هذا الشهر</span>
              <strong>{formatMarketSar(budget.amount)} <small>ريال</small></strong>
              <div className="wish-fund-progress" aria-label={`وُزّع ${distributedProgress}% من دفعات هذا الشهر`}>
                <motion.i initial={{ width: 0 }} animate={{ width: `${distributedProgress}%` }} transition={{ duration: .45 }} />
              </div>
              <div className="wish-fund-stats">
                <article><span>توزّع على الأماني</span><b>{formatMarketSar(budget.allocatedAmount)} ريال</b></article>
                <article><span>ينتظر وقته</span><b>{formatMarketSar(budget.reserveAmount)} ريال</b></article>
              </div>
              <p>{canManageBudget
                ? `آخر دفعة بواسطة ${budget.updatedByName} · ${budget.updatedAtLabel}`
                : `أضافها ${budget.updatedByName} · وتتحدث عندك تلقائيًا`}</p>
            </div>
          ) : (
            <div className="wish-budget-empty">
              <strong>{canManageBudget ? 'ما أضفت دفعة لهذا الشهر' : 'بانتظار دفعة هذا الشهر'}</strong>
              <p>{canManageBudget
                ? 'لما تودع مبلغًا في حساب الأماني اضغط «إضافة دفعة الشهر»، ورُشد يتولى التوزيع.'
                : 'أول ما يضيفها شخص عنده صلاحية تعديل الأماني ستظهر لك مباشرة.'}</p>
            </div>
          )}

          <div className="wish-reserve-balance">
            <div><span>الرصيد غير الموزع في صندوق رُشد</span><strong>{formatMarketSar(reserveBalance)} ريال</strong></div>
            <small>يبقى محفوظًا؛ رُشد لا يوزّعه من نفسه قبل ما تقررون.</small>
          </div>

          {budget && canManageBudget && !budgetFormOpen && (
            <button type="button" className="secondary-button wish-edit-budget" onClick={() => setBudgetFormOpen(true)}><Icon name="plus" size={16} /> إضافة دفعة أخرى</button>
          )}
          {!budget && canManageBudget && !budgetFormOpen && (
            <button type="button" className="primary-button wish-add-fund" onClick={() => setBudgetFormOpen(true)}><Icon name="plus" size={17} /> إضافة دفعة الشهر</button>
          )}
          {canManageBudget && budgetFormOpen && (
            <form className="shared-entry-form wish-budget-form" onSubmit={submitBudget}>
              <div className="shared-form-heading">
                <div><strong>{budget ? 'دفعة إضافية' : 'إضافة دفعة الشهر'}</strong><small>الدفعات السابقة ثابتة، والجديدة تتوزع حسب الحالات الحالية</small></div>
                <button type="button" onClick={() => setBudgetFormOpen(false)} aria-label="إلغاء إضافة الدفعة">×</button>
              </div>
              <label className="market-form-label"><span>المبلغ المضاف بالريال</span><input data-autofocus inputMode="decimal" value={budgetDraft} onChange={(event) => setBudgetDraft(event.target.value)} placeholder="مثلاً 500" aria-label="دفعة صندوق الأماني الشهرية" /></label>
              {budgetError && <div className="inline-form-error" role="alert">{budgetError}</div>}
              <button type="submit" disabled={budgetBusy}>{budgetBusy ? 'جاري التوزيع…' : 'إضافة وتوزيع الدفعة'}</button>
            </form>
          )}
        </section>
      )}

      {!canManageBudget && access !== 'none' && (
        <section className="wish-budget-link-note member-share-note"><Icon name="users" size={18} /><div><strong>صندوق عائلي مشترك</strong><p>ما تحتاج تربط حسابك براتبي؛ الدفعات والتوزيع تصل من مساحة العائلة حسب صلاحيتك.</p></div></section>
      )}

      {access === 'none' ? (
        <section className="module-empty-state"><span><Icon name="lock" size={24} /></span><strong>هذه الوحدة خاصة</strong><p>مالك البيت لم يفعّل لك الوصول إلى الأماني المشتركة.</p></section>
      ) : (
        <>
          <div className="goals-list">
            {wishes.length === 0 && <section className="module-empty-state"><span><Icon name="heart" size={24} /></span><strong>ما عندكم أماني مشتركة بعد</strong><p>ابدأ بأول أمنية وشاركها مع العائلة.</p></section>}
            {wishes.map((wish) => {
              const value = getSpentPercentage(wish.saved, wish.target)
              const forecast = getWishCompletionForecast({
                target: wish.target,
                saved: wish.saved,
                monthlyFundAmount: budget?.amount ?? 0,
                fundingLevel: wish.fundingLevel,
                activeShareTotal,
                monthKey,
              })
              return (
                <motion.button
                  type="button"
                  className={`full-goal-card wish-card wish-${wish.fundingLevel}`}
                  key={wish.id}
                  initial={{ opacity: 0, y: 9 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: .99 }}
                  onClick={() => openWishDetails(wish)}
                  aria-label={`تفاصيل أمنية ${wish.title}`}
                  aria-haspopup="dialog"
                >
                  <span className="goal-emoji"><Icon name="heart" size={25} /></span>
                  <div>
                    <div className="wish-heading"><h2>{wish.title}</h2><b>{value}%</b></div>
                    <p>{formatSar(wish.saved)} من {formatSar(wish.target)} ريال · {wish.owner}</p>
                    <ProgressBar value={value} />
                    <div className="wish-card-meta">
                      <span>{wish.fundingLabel}{wish.fundingLevel !== 'paused' ? ` · حصة الدفعة ${formatMarketSar(effectiveShare(wish))}%` : ''}</span>
                      <small>{wish.fundingLevel === 'paused'
                        ? 'رصيدها ثابت حتى تعيد تفعيلها'
                        : forecast?.label ?? 'أضف دفعة ليظهر الموعد المتوقع'}</small>
                    </div>
                    {wish.currentMonthAllocation > 0 && <em>+{formatMarketSar(wish.currentMonthAllocation)} ريال من دفعات هذا الشهر</em>}
                  </div>
                </motion.button>
              )
            })}
          </div>

          {access === 'edit' && !formOpen && <button type="button" className="primary-button" onClick={openAddForm}><Icon name="plus" size={17} /> إضافة أمنية مشتركة</button>}
          {access === 'view' && <div className="view-only-note">صلاحيتك الحالية: عرض فقط</div>}
          {formOpen && (
            <form className="shared-entry-form" onSubmit={submitWish}>
              <div className="shared-form-heading"><strong>أمنية جديدة</strong><button type="button" onClick={() => setFormOpen(false)} aria-label="إلغاء">×</button></div>
              <input data-autofocus placeholder="اسم الأمنية" value={title} onChange={(event) => setTitle(event.target.value)} />
              <input inputMode="decimal" placeholder="المبلغ المستهدف" value={target} onChange={(event) => setTarget(event.target.value)} />
              <input placeholder="الموعد أو المدة — اختياري" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
              <label className="wish-need-select">
                <span>حالة التمويل عند الإضافة</span>
                <select value={fundingLevel} onChange={(event) => setFundingLevel(event.target.value as WishFundingLevel)}>
                  {WISH_FUNDING_LEVELS.map((level) => {
                    const capacityError = getWishFundingCapacityError(portfolio, '__new__', level.id)
                    return <option value={level.id} disabled={Boolean(capacityError)} key={level.id}>{level.label}{level.share > 0 ? ` · ${level.share}%` : ''}</option>
                  })}
                </select>
              </label>
              {error && <div className="inline-form-error" role="alert">{error}</div>}
              <button type="submit" disabled={busy}>{busy ? 'جاري الحفظ…' : 'حفظ الأمنية'}</button>
            </form>
          )}
        </>
      )}

      <section className={`shared-status sync-${syncStatus}`}><span className="live-dot"/><div><strong>{sync.title}</strong><p>{sync.body}</p></div></section>

      <AnimatePresence>
        {selectedWish && (
          <motion.div className="wish-details-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedWishId(null)}>
            <motion.section
              ref={detailsRef}
              className="wish-details-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="wish-details-title"
              tabIndex={-1}
              initial={{ y: 55, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 55, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="wish-details-handle" />
              <header>
                <div><span>تفاصيل الأمنية</span><h2 id="wish-details-title">{selectedWish.title}</h2></div>
                <button type="button" data-autofocus onClick={() => setSelectedWishId(null)} aria-label="إغلاق تفاصيل الأمنية"><Icon name="close" size={20} /></button>
              </header>

              <div className="wish-details-progress">
                <strong>{formatMarketSar(selectedWish.saved)} <small>من {formatMarketSar(selectedWish.target)} ريال</small></strong>
                <ProgressBar value={getSpentPercentage(selectedWish.saved, selectedWish.target)} />
                <p>{selectedWish.deadline} · أضافها {selectedWish.owner}</p>
              </div>

              {(() => {
                const previewFundingLevel = canManageBudget
                  ? fundingDraft
                  : selectedWish.fundingLevel
                const previewActiveShareTotal = wishes
                  .filter((wish) => wish.saved < wish.target)
                  .reduce((total, wish) => {
                    const level = wish.id === selectedWish.id
                      ? previewFundingLevel
                      : wish.fundingLevel
                    return total + getWishFundingLevel(level).share
                  }, 0)
                const forecast = getWishCompletionForecast({
                  target: selectedWish.target,
                  saved: selectedWish.saved,
                  monthlyFundAmount: budget?.amount ?? 0,
                  fundingLevel: previewFundingLevel,
                  activeShareTotal: previewActiveShareTotal,
                  monthKey,
                })
                const isUnsavedPreview = canManageBudget
                  && previewFundingLevel !== selectedWish.fundingLevel
                return (
                  <div className="wish-forecast-card" aria-live="polite">
                    <span><Icon name="clock" size={19} /></span>
                    <div>
                      <small>موعد الوصول المتوقع{isUnsavedPreview ? ' · معاينة فورية' : ''}</small>
                      <strong>{previewFundingLevel === 'paused' ? 'الحساب متوقف مؤقتًا' : forecast?.label ?? 'يظهر بعد إضافة دفعة شهرية'}</strong>
                      <p>{previewFundingLevel === 'paused'
                        ? 'الرصيد السابق محفوظ، ولن يصلها مبلغ جديد وهي معلّقة.'
                        : forecast && forecast.monthlyShare > 0
                          ? `على وتيرة ${formatMarketSar(forecast.monthlyShare)} ريال كل شهر`
                          : 'نحتاج دفعة شهرية حتى نحسب الوتيرة.'}</p>
                    </div>
                  </div>
                )
              })()}

              {canManageBudget ? (
                <form className="wish-need-form" onSubmit={submitFundingLevel}>
                  <div><span>سرعة الأمنية</span><h3>كيف تتقدم من الدفعات القادمة؟</h3><p>أساسية واحدة، متوسطتان كحد أقصى، وثلاث أماني نشطة إجمالًا.</p></div>
                  <div className="wish-need-options">
                    {WISH_FUNDING_LEVELS.map((level) => {
                      const capacityError = getWishFundingCapacityError(portfolio, selectedWish.id, level.id)
                      const disabled = Boolean(capacityError) && level.id !== selectedWish.fundingLevel
                      return (
                        <button
                          type="button"
                          className={fundingDraft === level.id ? 'active' : ''}
                          onClick={() => {
                            setFundingDraft(level.id)
                            setDetailsError('')
                          }}
                          aria-pressed={fundingDraft === level.id}
                          disabled={disabled}
                          title={capacityError || undefined}
                          key={level.id}
                        >
                          <b>{level.share > 0 ? `${level.share}%` : 'إيقاف'}</b>
                          <span>{level.label}</span>
                          <small>{disabled ? capacityError : level.description}</small>
                        </button>
                      )
                    })}
                  </div>
                  <small className="wish-rebalance-note">التغيير يطبّق على الدفعات الجديدة فقط. الرصيد الحالي والتوزيعات القديمة لا تتغير. وإذا تجاوز مجموع الحالات 100% يوازن رُشد الحصص نسبيًا.</small>
                  {detailsError && <div className="inline-form-error" role="alert">{detailsError}</div>}
                  <button type="submit" className="wish-details-save" disabled={detailsBusy || fundingDraft === selectedWish.fundingLevel}>{detailsBusy ? 'جاري الحفظ…' : 'حفظ حالة الأمنية'}</button>
                </form>
              ) : (
                <div className="wish-view-need"><span>حالة التمويل الحالية</span><strong>{selectedWish.fundingLabel}{selectedWish.fundingShare > 0 ? ` · حصة الدفعة ${formatMarketSar(effectiveShare(selectedWish))}%` : ''}</strong><p>صلاحيتك عرض فقط، لذلك لا يمكنك تغييرها.</p></div>
              )}

              {canManageBudget && selectedWish.saved > 0 && (
                <div className="wish-reset-zone">
                  {!resetConfirmOpen ? (
                    <button type="button" onClick={() => setResetConfirmOpen(true)}>تصفير رصيد الأمنية</button>
                  ) : (
                    <div role="alert">
                      <strong>إرجاع {formatMarketSar(selectedWish.saved)} ريال إلى رصيد الصندوق؟</strong>
                      <p>لن تُحذف الأمنية، لكن تقدمها سيعود إلى الصفر. لا يمكن التراجع عن العملية.</p>
                      <div>
                        <button type="button" onClick={() => setResetConfirmOpen(false)} disabled={detailsBusy}>إلغاء</button>
                        <button type="button" onClick={() => void resetWish()} disabled={detailsBusy}>{detailsBusy ? 'جاري الإرجاع…' : 'تأكيد التصفير'}</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.main>
  )
}
