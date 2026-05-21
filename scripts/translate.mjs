#!/usr/bin/env node
/**
 * Gemini-powered Myanmar translation script.
 *
 * Usage:
 *   GEMINI_API_KEY=your_key node scripts/translate.mjs
 *
 * Reads the English strings from lib/i18n/translations.ts,
 * sends them to Gemini for Myanmar translation, and writes the
 * result back into the `my` export — replacing only the values,
 * preserving comments and structure.
 *
 * Requires: Node 18+ (uses built-in fetch)
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const translationsPath = join(__dir, '../lib/i18n/translations.ts')

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
if (!GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY environment variable is required.')
  console.error('Usage: GEMINI_API_KEY=your_key node scripts/translate.mjs')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 1. Extract English strings from the source file
// ---------------------------------------------------------------------------

const source = readFileSync(translationsPath, 'utf8')

// Pull out everything inside `export const en = { ... }`
const enMatch = source.match(/export const en = \{([\s\S]*?)\n\}/)
if (!enMatch) {
  console.error('Could not find `export const en` block in translations.ts')
  process.exit(1)
}

const enBlock = enMatch[1]
const keyValueRe = /^\s*'([^']+)':\s*'([^']*)',?/gm
const entries = {}
let m
while ((m = keyValueRe.exec(enBlock)) !== null) {
  entries[m[1]] = m[2]
}

console.log(`Found ${Object.keys(entries).length} strings to translate.`)

// ---------------------------------------------------------------------------
// 2. Call Gemini API
// ---------------------------------------------------------------------------

const prompt = `You are a professional Myanmar language translator for a mobile app.

Translate the following English UI strings into Myanmar (Burmese) script.

Rules:
- Return ONLY a JSON object mapping each key to its Myanmar translation.
- Keep placeholders like {page}, {total} exactly as-is.
- Keep technical values like '09XXXXXXXXX' unchanged.
- Use natural, friendly Myanmar phrasing suitable for a mobile loyalty points app.
- Do NOT add explanations or markdown.

English strings (JSON):
${JSON.stringify(entries, null, 2)}`

const GEMINI_MODEL = 'gemini-2.0-flash-lite'
const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

console.log(`Calling Gemini (${GEMINI_MODEL})…`)

const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2 },
  }),
})

if (!response.ok) {
  const body = await response.text()
  console.error(`Gemini API error ${response.status}: ${body}`)
  process.exit(1)
}

const json = await response.json()
const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

// Strip optional markdown code fences
const cleaned = rawText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

let translated
try {
  translated = JSON.parse(cleaned)
} catch {
  console.error('Failed to parse Gemini response as JSON.')
  console.error('Raw response:', rawText)
  process.exit(1)
}

console.log(`Received ${Object.keys(translated).length} translations.`)

// ---------------------------------------------------------------------------
// 3. Rebuild the `my` block in the source file
// ---------------------------------------------------------------------------

// Build the new `my` block lines
const myLines = Object.entries(entries).map(([key]) => {
  const val = translated[key] ?? entries[key] // fallback to English if missing
  const escaped = val.replace(/'/g, "\\'")
  return `  '${key}': '${escaped}',`
})

// Replace everything inside `export const my: typeof en = { ... }`
const newMyBlock = `export const my: typeof en = {\n${myLines.join('\n')}\n}`

let updated = source
if (/export const my: typeof en = \{[\s\S]*?\n\}/.test(updated)) {
  updated = updated.replace(/export const my: typeof en = \{[\s\S]*?\n\}/, newMyBlock)
} else {
  // Append after the en block if my block is missing
  updated = updated.replace(
    /(\nexport type TranslationKey)/,
    `\n${newMyBlock}\n$1`
  )
}

writeFileSync(translationsPath, updated, 'utf8')
console.log('Done! lib/i18n/translations.ts updated with Myanmar translations.')
console.log('Run `npm run build` to verify, then commit the changes.')
