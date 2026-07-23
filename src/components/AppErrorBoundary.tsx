import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Deliberately avoid logging financial or account context in production.
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="system-screen" role="alert">
        <div className="system-mark">!</div>
        <h1>رُشد لخبطها شوي.</h1>
        <p>بياناتك محفوظة. أعد تحميل الصفحة، وإذا استمرت المشكلة حاول بعد قليل.</p>
        <button type="button" onClick={() => window.location.reload()}>إعادة التحميل</button>
      </main>
    )
  }
}

export function NotFoundScreen() {
  return (
    <main className="system-screen">
      <div className="system-mark">404</div>
      <h1>هذه الصفحة مو موجودة.</h1>
      <p>ارجع للرئيسية وخلي رُشد يمسك الطريق من هنا.</p>
      <a href="/">العودة إلى رُشد</a>
    </main>
  )
}
