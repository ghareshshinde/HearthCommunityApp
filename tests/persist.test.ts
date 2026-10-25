import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

process.env.ADMIN_PASSWORD = 'pw-for-tests'
process.env.SESSION_SECRET = 'test-secret'

import { resetDbForTests } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'
import * as repo from '@/lib/repo'
import { ConflictError, configureStore, persist, restoreIfMissing, type BlobStore } from '@/lib/persist'
import { blankRow } from '@/lib/registration/rules'

/** In-memory stand-in for a Cloud Storage object with generation numbers. */
class MemoryStore implements BlobStore {
  data: Buffer | null = null
  gen = 0
  puts = 0
  async get() { return this.data ? { data: this.data, generation: String(this.gen) } : null }
  async put(data: Buffer, ifGeneration: string | null) {
    if (String(this.data ? this.gen : 0) !== String(ifGeneration ?? 0)) throw new ConflictError()
    this.data = data; this.gen += 1; this.puts += 1
    return String(this.gen)
  }
}

const contact = { registrantName: 'Asha Shah', registrantMobile: '9876543210', registrantEmail: '', emergencyName: 'Raj', emergencyMobile: '9123456780', waiver: true as const }
const person = { ...blankRow(), name: 'Asha Shah', age: '34', gender: 'Female', mobile: '9876543210', sports: ['Chess'], skill: 'casual' }

let dir: string
let path: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hearth-persist-'))
  path = join(dir, 'hearth.db')
  process.env.DATABASE_PATH = path
  resetDbForTests()
})
afterEach(() => { resetDbForTests(); rmSync(dir, { recursive: true, force: true }); configureStore(null) })

describe('durable storage for hosts with no disk', () => {
  it('a new container restores the last saved registrations from the bucket', async () => {
    const bucket = new MemoryStore()
    configureStore(bucket)
    const jsg = repo.getCommunityBySlug('jsg')!
    const ev = repo.listEvents(jsg.id)[0]
    expect(repo.createRegistration(ev, contact, [person]).ok).toBe(true)
    await persist()
    expect(bucket.puts).toBe(1)

    // "Container restart": local file gone, memory cleared.
    resetDbForTests(); rmSync(path, { force: true }); rmSync(path + '-wal', { force: true }); rmSync(path + '-shm', { force: true })
    configureStore(bucket)
    await restoreIfMissing(path)
    expect(existsSync(path)).toBe(true)
    const again = repo.getCommunityBySlug('jsg')!
    expect(repo.listRows(again.id, ev.id).map((r) => r.name)).toEqual(['Asha Shah'])
    // The restored copy can be saved again without a conflict.
    repo.createRegistration(ev, contact, [{ ...person, name: 'Second Person' }])
    await expect(persist()).resolves.toBeUndefined()
  })

  it('refuses to overwrite newer data written by another instance', async () => {
    const bucket = new MemoryStore()
    configureStore(bucket)
    repo.getCommunityBySlug('jsg')
    await persist()
    bucket.gen += 1 // another instance saved in between
    await expect(persist()).rejects.toBeInstanceOf(ConflictError)
  })

  it('snapshots are valid, complete SQLite databases', async () => {
    const bucket = new MemoryStore()
    configureStore(bucket)
    const jsg = repo.getCommunityBySlug('jsg')!
    repo.createRegistration(repo.listEvents(jsg.id)[0], contact, [person])
    await persist()
    const copy = join(dir, 'copy.db')
    require('node:fs').writeFileSync(copy, bucket.data!)
    const d = new DatabaseSync(copy)
    expect((d.prepare('select count(*) n from participant').get() as { n: number }).n).toBe(1)
    d.close()
  })

  it('does nothing when no bucket is configured', async () => {
    configureStore(null)
    repo.getCommunityBySlug('jsg')
    await expect(persist()).resolves.toBeUndefined()
  })
})

describe('admin password', () => {
  it('can be reset from the environment, which recovers a forgotten password', () => {
    repo.getCommunityBySlug('jsg') // first run creates the communities with ADMIN_PASSWORD
    resetDbForTests()
    process.env.RESET_ADMIN_PASSWORD = 'true'
    process.env.ADMIN_PASSWORD = 'brand-new-password'
    const jsg = repo.getCommunityBySlug('jsg')!
    delete process.env.RESET_ADMIN_PASSWORD
    process.env.ADMIN_PASSWORD = 'pw-for-tests'
    expect(verifyPassword('brand-new-password', jsg.admin_hash)).toBe(true)
    expect(verifyPassword('pw-for-tests', jsg.admin_hash)).toBe(false)
  })
})
