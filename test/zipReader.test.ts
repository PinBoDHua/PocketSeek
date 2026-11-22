import assert from 'node:assert/strict'
import test from 'node:test'
import { readArchive } from '../src/services/chat/history/zipReader.ts'
import { writeArchive } from '../src/services/chat/history/zipWriter.ts'

const bytesOf = async (stream: AsyncIterable<Uint8Array>) => {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

test('round-trips archive entries', async () => {
  const blob = await writeArchive([{ name: 'a.txt', blob: new Blob(['hello']) }])
  const file = new File([blob], 'test.zip')
  const entries: { path: string; text: string }[] = []
  for await (const entry of readArchive(file)) {
    entries.push({ path: entry.path, text: await bytesOf(entry.stream) })
  }
  assert.deepEqual(entries, [{ path: 'a.txt', text: 'hello' }])
})

test('rejects path traversal entry names on export', async () => {
  await assert.rejects(
    () => writeArchive([{ name: '../evil.txt', blob: new Blob(['x']) }]),
    /Invalid history archive entry/
  )
})