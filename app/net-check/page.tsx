'use client'

import { useState } from 'react'

/**
 * Standalone network diagnostic. Deliberately depends on NOTHING in this app:
 * no Supabase client, no i18n context, no shared UI components, no auth. If the
 * page itself needed Supabase to render, it could not report that Supabase is
 * unreachable -- which is the one thing it exists to find out.
 *
 * Excluded from middleware (see middleware.ts matcher) so it loads instantly even
 * when supabase.auth.getUser() is timing out for this visitor.
 *
 * Give the URL to someone in Myanmar on their normal connection, VPN OFF.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

const ROUNDS = 3
const HTTP_TIMEOUT_MS = 12000
const WS_TIMEOUT_MS = 12000
// Under this, a thrown fetch is a refused connection / DNS failure / TLS reset --
// i.e. something actively rejected us. Above it, the request was allowed out and
// then died, which looks like throttling or packet loss instead.
const FAST_FAIL_MS = 1500
const GOOD_MS = 2000

type Status = 'ok' | 'slow' | 'timeout' | 'blocked' | 'error'
type Probe = { ms: number; status: Status; detail: string }

const STATUS_STYLE: Record<Status, string> = {
  ok: 'bg-green-100 text-green-800',
  slow: 'bg-yellow-100 text-yellow-800',
  timeout: 'bg-red-100 text-red-800',
  blocked: 'bg-red-100 text-red-800',
  error: 'bg-red-100 text-red-800',
}

const STATUS_LABEL: Record<Status, string> = {
  ok: 'OK',
  slow: 'SLOW',
  timeout: 'TIMEOUT',
  blocked: 'BLOCKED',
  error: 'ERROR',
}

function classify(ms: number): Status {
  return ms < GOOD_MS ? 'ok' : 'slow'
}

async function probeHttp(url: string, init?: RequestInit): Promise<Probe> {
  const started = performance.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    const ms = Math.round(performance.now() - started)
    // A 404 here means the route is not deployed, not that the network failed --
    // worth calling out separately so it is not mistaken for a block.
    if (res.status === 404) return { ms, status: 'error', detail: 'HTTP 404 (not deployed)' }
    if (res.status >= 500) return { ms, status: 'error', detail: `HTTP ${res.status}` }
    return { ms, status: classify(ms), detail: `HTTP ${res.status}` }
  } catch (err) {
    const ms = Math.round(performance.now() - started)
    if (controller.signal.aborted) {
      return { ms, status: 'timeout', detail: `no reply in ${HTTP_TIMEOUT_MS / 1000}s` }
    }
    return {
      ms,
      status: ms < FAST_FAIL_MS ? 'blocked' : 'error',
      detail: err instanceof Error ? err.message : 'network error',
    }
  } finally {
    clearTimeout(timer)
  }
}

function probeWebSocket(url: string): Promise<Probe> {
  return new Promise((resolve) => {
    const started = performance.now()
    let settled = false
    let socket: WebSocket | null = null

    const finish = (probe: Probe) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        socket?.close()
      } catch {
        // closing a socket that never opened throws in some browsers; irrelevant here
      }
      resolve(probe)
    }

    const timer = setTimeout(
      () => finish({ ms: Math.round(performance.now() - started), status: 'timeout', detail: `no connection in ${WS_TIMEOUT_MS / 1000}s` }),
      WS_TIMEOUT_MS
    )

    try {
      socket = new WebSocket(url)
      socket.onopen = () => {
        const ms = Math.round(performance.now() - started)
        finish({ ms, status: classify(ms), detail: 'connected' })
      }
      socket.onerror = () => {
        const ms = Math.round(performance.now() - started)
        finish({ ms, status: ms < FAST_FAIL_MS ? 'blocked' : 'error', detail: 'connection refused' })
      }
    } catch (err) {
      finish({ ms: 0, status: 'error', detail: err instanceof Error ? err.message : 'cannot open socket' })
    }
  })
}

type TestDef = {
  id: string
  en: string
  my: string
  hint: string
  run: () => Promise<Probe>
}

const TESTS: TestDef[] = [
  {
    id: 'vercel',
    en: '1. This app (Vercel)',
    my: '၁။ ဤအက်ပ် (Vercel)',
    hint: 'If this fails, nothing else can work.',
    run: () => probeHttp('/api/net-check'),
  },
  {
    id: 'sb-auth',
    en: '2. Supabase login server — direct',
    my: '၂။ Supabase login ဆာဗာ — တိုက်ရိုက်',
    hint: 'Login and registration use this today.',
    run: () => probeHttp(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: ANON_KEY } }),
  },
  {
    id: 'sb-rest',
    en: '3. Supabase database — direct',
    my: '၃။ Supabase ဒေတာဘေ့စ် — တိုက်ရိုက်',
    hint: 'Points, bookings and rewards read through this.',
    run: () => probeHttp(`${SUPABASE_URL}/rest/v1/`, { method: 'HEAD', headers: { apikey: ANON_KEY } }),
  },
  {
    id: 'sb-ws',
    en: '4. Supabase live updates (WebSocket)',
    my: '၄။ Supabase live update (WebSocket)',
    hint: 'Real-time slot and points updates.',
    run: () => probeWebSocket(`${SUPABASE_URL.replace(/^http/i, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(ANON_KEY)}&vsn=1.0.0`),
  },
  {
    id: 'proxy',
    en: '5. Supabase through this app (the proposed fix)',
    my: '၅။ ဤအက်ပ်မှတစ်ဆင့် Supabase (ပြင်ဆင်မှုအဆိုပြုချက်)',
    hint: 'Same data, but the browser never names supabase.co.',
    run: () => probeHttp('/sb/auth/v1/health', { headers: { apikey: ANON_KEY } }),
  },
]

const OPERATORS = ['MPT', 'ATOM', 'Ooredoo', 'Mytel', 'Other / WiFi', 'Not in Myanmar']

type ServerInfo = {
  vercelRegion?: string
  clientCountry?: string | null
  clientCity?: string | null
  supabaseFromVercel?: { ms: number; ok: boolean; detail: string }
}

export default function NetCheckPage() {
  const [lang, setLang] = useState<'en' | 'my'>('en')
  const [operator, setOperator] = useState('')
  const [connType, setConnType] = useState<'mobile' | 'wifi' | ''>('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [results, setResults] = useState<Record<string, Probe[]>>({})
  const [server, setServer] = useState<ServerInfo | null>(null)
  const [copied, setCopied] = useState(false)

  const my = lang === 'my'

  async function runAll() {
    setRunning(true)
    setResults({})
    setServer(null)
    setCopied(false)

    const collected: Record<string, Probe[]> = {}

    for (let round = 1; round <= ROUNDS; round++) {
      for (const test of TESTS) {
        setProgress(`${my ? 'စစ်ဆေးနေသည်' : 'Testing'} ${round}/${ROUNDS} — ${my ? test.my : test.en}`)
        const probe = await test.run()
        collected[test.id] = [...(collected[test.id] ?? []), probe]
        // Re-set a fresh object each time so React sees the change and the user
        // watches results fill in rather than staring at a spinner for a minute.
        setResults({ ...collected })
      }
    }

    // Server-side facts, fetched last so a hanging probe cannot delay the visible tests.
    try {
      const res = await fetch('/api/net-check', { cache: 'no-store' })
      if (res.ok) setServer(await res.json())
    } catch {
      // Test 1 already recorded whether Vercel is reachable; nothing more to say here.
    }

    setProgress('')
    setRunning(false)
  }

  const verdict = buildVerdict(results)
  const report = buildReport({ results, server, operator, connType, verdict })

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
    } catch {
      // Clipboard API needs a secure context and permission; the raw text is
      // already on screen below for manual selection if this fails.
      setCopied(false)
    }
  }

  const done = Object.keys(results).length === TESTS.length && !running

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {my ? 'ကွန်ရက် စစ်ဆေးမှု' : 'Connection Test'}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {my
                ? 'VPN ပိတ်ထားပါ။ ပုံမှန်အင်တာနက်ဖြင့်သာ စစ်ဆေးပါ။'
                : 'Turn VPN OFF. Test on your normal connection.'}
            </p>
          </div>
          <button
            onClick={() => setLang(my ? 'en' : 'my')}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700"
          >
            {my ? 'EN' : 'မြန်မာ'}
          </button>
        </header>

        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <label className="block text-sm font-medium text-gray-700">
            {my ? 'အော်ပရေတာ' : 'Mobile operator / ISP'}
          </label>
          <div className="flex flex-wrap gap-2">
            {OPERATORS.map((op) => (
              <button
                key={op}
                onClick={() => setOperator(op)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  operator === op
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                {op}
              </button>
            ))}
          </div>

          <label className="block pt-2 text-sm font-medium text-gray-700">
            {my ? 'ချိတ်ဆက်မှုအမျိုးအစား' : 'Connection type'}
          </label>
          <div className="flex gap-2">
            {(['mobile', 'wifi'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setConnType(c)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  connType === c
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                {c === 'mobile' ? (my ? 'မိုဘိုင်းဒေတာ' : 'Mobile data') : 'WiFi'}
              </button>
            ))}
          </div>
        </section>

        <button
          onClick={runAll}
          disabled={running}
          className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white disabled:opacity-60"
        >
          {running ? (my ? 'စစ်ဆေးနေသည်…' : 'Testing…') : my ? 'စစ်ဆေးမှု စတင်ရန်' : 'Start test'}
        </button>

        {progress && <p className="text-center text-sm text-gray-600">{progress}</p>}

        {Object.keys(results).length > 0 && (
          <section className="space-y-3">
            {TESTS.map((test) => {
              const probes = results[test.id] ?? []
              return (
                <div key={test.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold text-gray-900">{my ? test.my : test.en}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{test.hint}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {probes.map((p, i) => (
                      <span
                        key={i}
                        className={`rounded-md px-2 py-1 font-mono text-xs ${STATUS_STYLE[p.status]}`}
                        title={p.detail}
                      >
                        {STATUS_LABEL[p.status]} · {p.ms}ms
                      </span>
                    ))}
                    {probes.length < ROUNDS && running && (
                      <span className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-500">…</span>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {done && (
          <>
            <section className="rounded-xl border-2 border-gray-900 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {my ? 'ရလဒ်' : 'Verdict'}
              </p>
              <p className="mt-1 text-base font-medium text-gray-900">{verdict}</p>
            </section>

            <button
              onClick={copyReport}
              className="w-full rounded-xl border border-gray-300 bg-white px-6 py-3 font-medium text-gray-800"
            >
              {copied ? (my ? 'ကူးယူပြီး ✓' : 'Copied ✓') : my ? 'ရလဒ်ကို ကူးယူရန်' : 'Copy full report'}
            </button>

            <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 font-mono text-xs leading-relaxed text-gray-100">
              {report}
            </pre>
          </>
        )}
      </div>
    </main>
  )
}

/**
 * Turns the raw probes into the one sentence the developer actually needs.
 * The interesting case is "Vercel fine + direct Supabase dead + proxy fine",
 * which is simultaneously a diagnosis and a proof that the fix works.
 */
function buildVerdict(results: Record<string, Probe[]>): string {
  const worked = (id: string) => (results[id] ?? []).some((p) => p.status === 'ok' || p.status === 'slow')
  const everFailed = (id: string) => (results[id] ?? []).some((p) => p.status !== 'ok' && p.status !== 'slow')
  if (Object.keys(results).length < TESTS.length) return ''

  if (!worked('vercel')) {
    return 'The app itself (Vercel) is unreachable on this network. This is bigger than Supabase — the whole site is blocked or the connection dropped mid-test.'
  }

  const directDead = !worked('sb-auth') && !worked('sb-rest')
  const proxyOk = worked('proxy')

  if (directDead && proxyOk) {
    return 'CONFIRMED: this network blocks supabase.co directly, but reaches it fine through the app. Routing Supabase through the app fixes this connection.'
  }
  if (directDead && !proxyOk) {
    return 'This network cannot reach supabase.co directly, and the proxy route did not answer either — most likely the proxy is not deployed yet. Redeploy and re-run.'
  }
  if (everFailed('sb-auth') || everFailed('sb-rest')) {
    return 'Supabase is reachable but INTERMITTENT on this network — some attempts fail or time out. This matches the "sometimes works, sometimes not" reports and will still break registration.'
  }
  if (!worked('sb-ws')) {
    return 'REST works, but the live-updates WebSocket is blocked on this network. Real-time slot and points updates will silently never arrive here.'
  }
  return 'Supabase is fully reachable on this network. This connection is not the one causing the problem — test on a different operator.'
}

function buildReport(input: {
  results: Record<string, Probe[]>
  server: ServerInfo | null
  operator: string
  connType: string
  verdict: string
}): string {
  const { results, server, operator, connType, verdict } = input
  const lines: string[] = []
  lines.push('=== AKO ATP CONNECTION TEST ===')
  lines.push(`time      : ${new Date().toISOString()}`)
  lines.push(`operator  : ${operator || '(not selected)'}`)
  lines.push(`conn type : ${connType || '(not selected)'}`)
  if (server) {
    lines.push(`vercel    : ${server.vercelRegion ?? '?'}`)
    lines.push(`seen from : ${server.clientCity ?? '?'}, ${server.clientCountry ?? '?'}`)
    if (server.supabaseFromVercel) {
      const s = server.supabaseFromVercel
      lines.push(`vercel->supabase: ${s.ok ? 'OK' : 'FAIL'} ${s.ms}ms (${s.detail})`)
    }
  }
  lines.push(`ua        : ${typeof navigator !== 'undefined' ? navigator.userAgent : '?'}`)
  lines.push('')
  for (const test of TESTS) {
    const probes = results[test.id] ?? []
    const cells = probes.map((p) => `${STATUS_LABEL[p.status]} ${p.ms}ms (${p.detail})`).join(' | ')
    lines.push(`${test.en}`)
    lines.push(`   ${cells || 'not run'}`)
  }
  lines.push('')
  lines.push(`VERDICT: ${verdict}`)
  return lines.join('\n')
}
