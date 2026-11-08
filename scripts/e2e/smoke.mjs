/**
 * Builds a character through the wizard, saves it, reloads, and visits every section.
 * Fails (exit code 1) if anything is missing or the console logs an error.
 */
import assert from 'node:assert/strict'
import { BASE_URL, launch, report, screenshotter } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'smoke')

await page.goto(BASE_URL)
await page.waitForSelector('.option')
const next = () => page.locator('.wizard-nav .btn.primary').click()

await page.locator('.option', { hasText: 'Warrior' }).click()
await next()
await page.locator('.option', { hasText: 'Dwarf' }).click()
await next()
await page.locator('.option', { hasText: 'Soldier' }).click()
await next()
await page.getByRole('button', { name: 'Suggest spread' }).click()
await next()
for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Add one Armor' }).click()
for (const ability of ['Provoke', 'Disable', 'Cleave', 'Intercept']) {
  await page.locator('.option', { hasText: ability }).first().click()
}
await next()

for (const item of ['Torch', 'Torch', 'Torch', 'Ration', 'Bandage']) {
  await page.getByRole('button', { name: `Buy one ${item}` }).click()
}
assert.match(await page.locator('.coin-purse').innerText(), /4 of 10 coins left/)
assert.ok(await page.getByRole('button', { name: 'Buy one Healing Potion' }).isDisabled(), 'cannot overspend')
await shot('equipment', true)
await next()

await page.getByPlaceholder('Name your adventurer').fill('Smoke Test')
await page.getByRole('button', { name: /^Save$/ }).click()
await page.reload()
await page.waitForSelector('.option')
assert.match(await page.getByRole('button', { name: /Characters/ }).innerText(), /\(1\)/)

await page.getByRole('button', { name: 'Sheet', exact: true }).click()
await page.waitForSelector('.sheet')
await shot('sheet', true)

await page.getByRole('button', { name: 'Token Bag' }).click()
await page.getByRole('button', { name: 'Draw tokens' }).click()
await page.waitForSelector('.outcome', { timeout: 20000 })
await shot('bag')

await page.getByRole('button', { name: 'Dungeon' }).click()
await page.waitForSelector('.tutorial-intro')
await shot('dungeon-setup', true)

console.log('smoke test passed')
await browser.close()
report(errors)
