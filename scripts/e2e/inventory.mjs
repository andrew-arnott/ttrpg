/** Checks the instant item hover boxes, the three-torch party limit and the token bag viewer. */
import assert from 'node:assert/strict'
import { enterDungeon, launch, report, screenshotter } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'inventory')

await enterDungeon(page)

const counts = await page.locator('.inv-slot.torch .inv-count').allInnerTexts()
assert.equal(counts.reduce((n, c) => n + Number(c), 0), 3, 'the party has three torches in total')
assert.equal(await page.locator('.inv-slot', { hasText: /ration/i }).count(), 0)

const slot = page.locator('.inv-slot').first()
await slot.hover()
const box = page.locator('.tip:hover .tip-box')
await box.waitFor({ state: 'visible', timeout: 500 })
assert.match(await box.innerText(), /×/)
await shot('item-tip', true)
await page.mouse.move(2, 2)

await page.getByRole('button', { name: 'Bag', exact: true }).first().click()
const dialog = page.getByRole('dialog')
await dialog.waitFor()
assert.match(await dialog.innerText(), /bag/i)
assert.ok((await dialog.locator('.chip').count()) > 5, 'the bag lists its tokens')
await dialog.locator('.chip').first().hover()
await dialog.locator('.tip:hover .tip-box').waitFor({ state: 'visible', timeout: 500 })
await shot('bag', true)
await page.getByRole('button', { name: 'Close' }).click()
await dialog.waitFor({ state: 'detached' })

console.log('inventory check passed')
await browser.close()
report(errors)
