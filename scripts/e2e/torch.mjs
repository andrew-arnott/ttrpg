/** Lets the torch burn down by resolving Intervals and checks that the HUD warns once it is dim. */
import assert from 'node:assert/strict'
import { enterDungeon, launch, report, screenshotter, skipOverlay } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'torch')

await enterDungeon(page)
assert.equal(await page.locator('.torch-hud .blocker-text').count(), 0, 'no warning while the torch is bright')

for (let i = 0; i < 4; i++) {
  await page.getByRole('button', { name: 'Resolve Interval' }).click()
  await skipOverlay(page)
}

assert.match(await page.locator('.torch-level').innerText(), /Dim/i)
assert.match(await page.locator('.torch-hud .blocker-text').innerText(), /running out.*right-clicking/i)
await shot('dim', true)

console.log('torch check passed')
await browser.close()
report(errors)
