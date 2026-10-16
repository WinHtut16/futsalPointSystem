'use client'

import { useEffect, useRef } from 'react'
import { useRive, RuntimeLoader, Layout, Fit, Alignment } from '@rive-app/react-canvas'
import canvasPkg from '@rive-app/canvas/package.json'
import { RIVE_STATE_MACHINE } from '@/lib/park/rive'
import type { RiveValues } from './RiveSlot'

// Self-hosted WASM (scripts/copy-rive-wasm.mjs). The version query keeps a
// cached WASM from outliving a runtime upgrade.
RuntimeLoader.setWasmUrl(`/rive/rive.wasm?v=${canvasPkg.version}`)

export default function RivePlayer({
  src,
  artboard,
  values,
  onReady,
  onFail,
}: {
  src: string
  artboard: string
  values?: RiveValues
  onReady: () => void
  onFail: () => void
}) {
  const { rive, RiveComponent } = useRive({
    src,
    artboard,
    stateMachine: RIVE_STATE_MACHINE,
    autoplay: true,
    autoBind: true,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    onLoad: onReady,
    onLoadError: onFail,
  })

  // Push page state into the artboard's view model whenever it changes.
  useEffect(() => {
    const vm = rive?.viewModelInstance
    if (!vm || !values) return
    for (const [k, v] of Object.entries(values.numbers ?? {})) {
      const p = vm.number(k)
      if (p) p.value = v
    }
    for (const [k, v] of Object.entries(values.booleans ?? {})) {
      const p = vm.boolean(k)
      if (p) p.value = v
    }
  }, [rive, values])

  // Triggers fire on counter changes, not on first bind.
  const fired = useRef<Record<string, number>>({})
  useEffect(() => {
    const vm = rive?.viewModelInstance
    if (!vm || !values?.triggers) return
    for (const [k, n] of Object.entries(values.triggers)) {
      if (n > 0 && fired.current[k] !== n) vm.trigger(k)?.trigger()
      fired.current[k] = n
    }
  }, [rive, values])

  return <RiveComponent className="absolute inset-0 h-full w-full" />
}
