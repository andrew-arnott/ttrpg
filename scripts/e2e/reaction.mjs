/** Plays rounds of the sample battle until a Triggered ability question appears, then answers it. */
import assert from 'node:assert/strict'
import { enterDungeon, launch, report, screenshotter, skipOverlay } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'reaction')

await enterDungeon(page)
await page.getByRole('button', { name: 'Start sample battle' }).click()
await skipOverlay(page)
await page.waitForSelector('.card-head h2')

let asked = false
for (let round = 0; round < 6 && !asked; round++) {
  for (let i = 0; i < 4 && !asked; i++) {
    const endTurn = page.getByRole('button', { name: 'End turn' })
    if (!(await endTurn.count())) break
    await endTurn.click()
  }
  const prompt = page.getByRole('button', { name: /^Use / })
  const outcome = await Promise.race([
    prompt.first().waitFor({ timeout: 90000 }).then(() => 'prompt'),
    page.waitForSelector('.resolution', { timeout: 90000 }).then(() => 'overlay'),
  ]).catch(() => 'none')
  if (outcome === 'overlay') {
    await skipOverlay(page)
    asked = (await prompt.count()) > 0
  } else asked = outcome === 'prompt'
  if (!asked && (await page.getByText('The party has fallen').count())) break
}

assert.ok(asked, 'a Triggered ability question should come up during the sample battle')
assert.ok(await page.locator('.card-head h2', { hasText: /use .+\?/i }).count())
await shot('prompt', true)

await page.getByRole('button', { name: /^Use / }).click()
await page.waitForSelector('.resolution', { timeout: 30000 })
await shot('result')
await skipOverlay(page)

console.log('reaction check passed')
await browser.close()
report(errors)
