/** Keeps trying the locked door until a failed test lets Sister Maren pray, then answers the question. */
import assert from 'node:assert/strict'
import { enterDungeon, launch, report, screenshotter, skipOverlay } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'prayer')

await enterDungeon(page)
const select = (name) => page.getByLabel(`Action for ${name}`)
const usePrayer = page.getByRole('button', { name: 'Use Prayer' })

let asked = false
for (let attempt = 0; attempt < 12 && !asked; attempt++) {
  await select('Brann Ironhold').selectOption('unlock:entranceDoor:break')
  await select('Wren Quickfingers').selectOption('unlock:entranceDoor:pick')
  await select('Sister Maren').selectOption('watch')
  await select('Ilvara Dawnleaf').selectOption('watch')
  await page.getByRole('button', { name: 'Resolve Interval' }).click()

  const first = await Promise.race([
    usePrayer.waitFor({ timeout: 30000 }).then(() => 'prompt'),
    page.waitForSelector('.resolution', { timeout: 30000 }).then(() => 'overlay'),
  ])
  if (first === 'overlay') {
    await skipOverlay(page)
    asked = (await usePrayer.count()) > 0
  } else asked = true
  if (!asked && (await page.getByLabel('Action for Brann Ironhold').locator('option[value^="unlock"]').count()) === 0) break
}

assert.ok(asked, 'a failed test should have let Sister Maren pray')
assert.ok(await page.locator('.card-head h2', { hasText: /use Prayer\?/i }).count())
await shot('prompt', true)
await usePrayer.click()
await page.waitForSelector('.resolution', { timeout: 30000 })
assert.match(await page.locator('.resolution').innerText(), /Interval|Door|Break|Pick|lock/i)
await shot('result')
await skipOverlay(page)

console.log('prayer check passed')
await browser.close()
report(errors)
