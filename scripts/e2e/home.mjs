/** The site opens on a home page that leads to each section. */
import assert from 'node:assert/strict'
import { BASE_URL, launch, report, screenshotter } from './lib.mjs'

const { browser, page, errors } = await launch()
const shot = screenshotter(page, 'home')

await page.goto(BASE_URL)
await page.getByRole('heading', { name: 'Welcome, adventurer' }).waitFor()
assert.equal(await page.getByRole('button', { name: 'Home' }).getAttribute('aria-current'), 'page')
assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).isVisible(), false)
await shot('home', true)

const destinations = [
  ['Start creating', /#\/creator/, '.stepper'],
  ['Enter the dungeon', /#\/dungeon/, '.tutorial-intro'],
  ['Open the rules', /#\/rules/, '.rules-toc'],
  ['Draw tokens', /#\/bag/, null],
  ['See the sheet', /#\/sheet/, null],
]
for (const [label, hash, text] of destinations) {
  await page.goto(BASE_URL)
  await page.getByRole('button', { name: label }).click()
  await page.waitForURL(hash)
  if (text) await page.locator(text).first().waitFor()
}

await page.getByRole('link', { name: 'Fantasy TTRPG' }).click()
await page.getByRole('heading', { name: 'Welcome, adventurer' }).waitFor()

await browser.close()
report(errors)
console.log('home check passed')
