import assert from 'node:assert/strict'
import test from 'node:test'
import { isWebUrl } from '../src/utils/url.ts'

test('accepts http and https URLs', () => {
  assert.equal(isWebUrl('https://example.com/a?b=1'), true)
  assert.equal(isWebUrl('http://127.0.0.1:4174/'), true)
})

test('rejects dangerous or relative URLs', () => {
  assert.equal(isWebUrl('javascript:alert(1)'), false)
  assert.equal(isWebUrl('data:text/html,hello'), false)
  assert.equal(isWebUrl('/relative/path'), false)
  assert.equal(isWebUrl('not a url'), false)
})