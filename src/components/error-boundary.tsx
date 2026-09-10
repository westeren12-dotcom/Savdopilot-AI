import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = { error: Error | null }

/** Shows a visible error card instead of a blank screen when rendering crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep it in the console for debugging, but never blank the page silently.
    console.error('UI crash:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mesh grid min-h-screen place-items-center px-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
            <h1 className="font-display text-2xl">Xatolik yuz berdi</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sahifa render qilishda xatolik bo‘ldi. Quyidagi tafsilotlarni dasturchiga yuboring.
            </p>
            <pre className="mt-3 max-h-40 overflow-auto rounded-xl bg-muted p-3 text-xs text-destructive">
              {this.state.error.message}
            </pre>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => location.reload()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Qayta yuklash
              </button>
              <button
                type="button"
                onClick={() => this.setState({ error: null })}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
              >
                Davom etish
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
