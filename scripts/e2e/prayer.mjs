/** Keeps trying the locked door until a failed test lets Sister Maren pray, then answers the question. */
import assert from 'node:assert/strict'
import { enterDungeon, launch, report, screenshotter, skipOverlay } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'prayer')

await enterDungeon(page)
const select = (name) => page.getByLabel(`Action for ${name}`)
const usePrayer = page.getByRole('button', { name: 'Use Prayer' })

let asked = false
for (let dungeon = 0; dungeon < 16 && !asked; dungeon++) {
  if (dungeon > 0) {
    await page.getByRole('button', { name: 'Leave dungeon' }).click()
    await enterDungeon(page)
  }
  for (let attempt = 0; attempt < 8 && !asked; attempt++) {
    if ((await select('Brann Ironhold').locator('option[value^="unlock"]').count()) === 0) break
    await select('Brann Ironhold').selectOption('unlock:entranceDoor:break')
    for (const name of ['Wren Quickfingers', 'Sister Maren', 'Ilvara Dawnleaf']) await select(name).selectOption('watch')
    await page.getByRole('button', { name: 'Resolve Interval' }).click()

    for (let guard = 0; guard < 6 && !asked; guard++) {
      const returnIt = page.getByRole('button', { name: 'Return it' })
      const first = await Promise.race([
        usePrayer.waitFor({ timeout: 30000 }).then(() => 'prompt', () => 'none'),
        returnIt.waitFor({ timeout: 30000 }).then(() => 'return', () => 'none'),
        page.waitForSelector('.resolution', { timeout: 30000 }).then(() => 'overlay', () => 'none'),
      ])
      if (first === 'return') await returnIt.click()
      else if (first === 'overlay') {
        await skipOverlay(page)
        asked = (await usePrayer.count()) > 0
        break
      } else {
        asked = first === 'prompt'
        break
      }
      asked = (await usePrayer.count()) > 0
    }
  }
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
