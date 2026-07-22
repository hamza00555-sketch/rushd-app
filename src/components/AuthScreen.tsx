import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { RushdCharacter } from './RushdCharacter'
import { signInToRushd, signUpToRushd } from '../lib/householdRepository'
import { getFirebaseErrorMessage } from '../lib/firebaseErrors'

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (mode === 'signup' && name.trim().length < 2) {
      setError('اكتب اسمًا من حرفين على الأقل.')
      return
    }
    if (!email.trim() || password.length < 6) {
      setError('اكتب بريدًا صحيحًا وكلمة مرور من 6 أحرف على الأقل.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signup') {
        await signUpToRushd(name, email, password)
      } else {
        await signInToRushd(email, password)
      }
      await onAuthenticated()
    } catch (cause: unknown) {
      setError(getFirebaseErrorMessage(cause, 'تعذر تسجيل الدخول.'))
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (nextMode: 'signin' | 'signup') => {
    setMode(nextMode)
    setError('')
  }

  return (
    <main className="auth-screen">
      <motion.section className="auth-welcome" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="auth-brand">
          <span className="auth-logo" aria-hidden="true">ر</span>
          <div><strong>رُشد</strong><small>خطتك أوضح</small></div>
        </div>
        <div className="auth-character"><RushdCharacter mood="happy" size="md" message="بياناتك المالية لك وحدك. خلّنا نبدأ بحساب آمن." /></div>
        <div className="auth-copy">
          <span>مساحتك المالية الخاصة</span>
          <h1>{mode === 'signin' ? 'أهلًا بعودتك.' : 'ابدأ شهرًا مرتبًا من أول ريال.'}</h1>
          <p>سجّل الدخول للوصول إلى خططك، مصروفاتك، وأدوات العائلة من أي جهاز.</p>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="نوع الدخول">
          <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')}>تسجيل الدخول</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>حساب جديد</button>
        </div>

        <form className="auth-main-form" onSubmit={submit}>
          {mode === 'signup' && (
            <label>
              <span>الاسم</span>
              <input data-autofocus autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="كيف نناديك؟" />
            </label>
          )}
          <label>
            <span>البريد الإلكتروني</span>
            <input data-autofocus={mode === 'signin' ? true : undefined} type="email" inputMode="email" autoCapitalize="none" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
          </label>
          <label>
            <span>كلمة المرور</span>
            <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="6 أحرف على الأقل" />
          </label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button type="submit" className="auth-submit" disabled={busy}>{busy ? 'جاري الاتصال…' : mode === 'signin' ? 'دخول إلى رُشد' : 'إنشاء حساب رُشد'}</button>
        </form>

        <details className="privacy-note">
          <summary>كيف يحمي رُشد بياناتك؟</summary>
          <p>يخزن رُشد بياناتك المالية داخل حسابك في Firebase. الراتب والمصروفات والاستثمارات خاصة بك، ولا يراها أفراد العائلة. المشاركة تقتصر على الوحدات والصلاحيات التي تختارها.</p>
        </details>
      </motion.section>
    </main>
  )
}
