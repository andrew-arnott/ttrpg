import fs from 'node:fs'
import { chromium } from 'playwright-core'

/** Where the built app is served. Start it with `npm run build && npm run preview:e2e` in the repo root. */
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4817/ttrpg/'
export const OUT_DIR = process.env.OUT_DIR ?? '/tmp/ttrpg-e2e'
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome'

/** Starts a headless browser and a page that records console errors and failed requests. */
export async function launch({ width = 1280, height = 900 } = {}) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage()
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`))
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`))
  return { browser, page, errors }
}

export function screenshotter(page, prefix) {
  const taken = new Set()
  return async (name, fullPage = false) => {
    if (taken.has(name)) return
    taken.add(name)
    await page.screenshot({ path: `${OUT_DIR}/${prefix}-${name}.png`, fullPage })
  }
}

/** Picks the four sample characters on the dungeon setup screen and enters the dungeon. */
export const SAMPLE_PARTY = ['Brann Ironhold', 'Wren Quickfingers', 'Sister Maren', 'Ilvara Dawnleaf']

export async function enterDungeon(page, names = SAMPLE_PARTY) {
  await page.goto(`${BASE_URL}#/dungeon`)
  await page.waitForSelector('.option')
  for (const name of names) await page.locator('.option', { hasText: name }).click()
  await page.getByRole('button', { name: 'Enter the dungeon' }).click()
  await page.waitForSelector('.plan-row')
}

/** Plays the animated overlay to its summary and dismisses it. */
export async function skipOverlay(page) {
  await page.waitForSelector('.resolution')
  const skip = page.getByRole('button', { name: 'Skip to summary' })
  const next = page.getByRole('button', { name: 'Continue' })
  await skip.or(next).first().waitFor()
  if (await skip.count()) await skip.click({ timeout: 3000 }).catch(() => {})
  await next.click()
}

export function report(errors) {
  console.log('console errors:', errors.length === 0 ? 'none' : JSON.stringify(errors))
  if (errors.length > 0) process.exitCode = 1
}
