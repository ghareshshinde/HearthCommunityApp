import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { getDb } from './db'

/**
 * Durability for hosts with no persistent disk (Google Cloud Run). The live database stays a local SQLite file;
 * after every write a consistent snapshot is stored in one Cloud Storage object, and a fresh container restores
 * it before serving. Writes are guarded by the object's generation number, so a second running instance can never
 * silently overwrite newer data: it gets an error instead. Run a single instance (max instances = 1).
 */
export interface BlobStore {
  get(): Promise<{ data: Buffer; generation: string } | null>
  /** Store data only if the stored generation still equals `ifGeneration` (null = object must not exist yet). */
  put(data: Buffer, ifGeneration: string | null): Promise<string>
}

export class ConflictError extends Error {
  constructor() {
    super('Another instance has saved newer data. Run the service with max instances set to 1.')
  }
}

export class GcsStore implements BlobStore {
  constructor(private bucket: string, private object: string) {}
  private async file() {
    const { Storage } = await import('@google-cloud/storage') // uses the service account of the Cloud Run service
    return new Storage().bucket(this.bucket).file(this.object)
  }
  async get() {
    const f = await this.file()
    const [exists] = await f.exists()
    if (!exists) return null
    const [data] = await f.download()
    const [meta] = await f.getMetadata()
    return { data, generation: String(meta.generation) }
  }
  async put(data: Buffer, ifGeneration: string | null) {
    const f = await this.file()
    try {
      await f.save(data, { resumable: false, preconditionOpts: { ifGenerationMatch: ifGeneration ? Number(ifGeneration) : 0 } })
    } catch (e) {
      if ((e as { code?: number }).code === 412) throw new ConflictError()
      throw e
    }
    const [meta] = await f.getMetadata()
    return String(meta.generation)
  }
}

let store: BlobStore | null | undefined
let generation: string | null = null
let chain: Promise<unknown> = Promise.resolve()

export function configureStore(s: BlobStore | null) {
  store = s
  generation = null
  chain = Promise.resolve()
}
function currentStore(): BlobStore | null {
  if (store !== undefined) return store
  const bucket = process.env.GCS_BUCKET
  store = bucket ? new GcsStore(bucket, process.env.GCS_OBJECT ?? 'hearth/hearth.db') : null
  return store
}
export const persistenceEnabled = () => currentStore() !== null

/** Called once at server start, before the database is opened. A container that already has its file keeps it. */
export async function restoreIfMissing(path: string) {
  const s = currentStore()
  if (!s || path === ':memory:' || existsSync(path)) return
  const blob = await s.get()
  if (!blob) return
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, blob.data)
  generation = blob.generation
}

async function snapshot(s: BlobStore) {
  const tmp = join(tmpdir(), `hearth-snapshot-${process.pid}.db`)
  rmSync(tmp, { force: true })
  getDb().exec(`vacuum into '${tmp}'`)
  try {
    generation = await s.put(readFileSync(tmp), generation)
  } finally {
    rmSync(tmp, { force: true })
  }
}

/** Await this after a write, before replying, so a registration is never confirmed that only exists in memory. */
export function persist(): Promise<void> {
  const s = currentStore()
  if (!s) return Promise.resolve()
  const run = chain.catch(() => undefined).then(() => snapshot(s))
  chain = run
  return run as Promise<void>
}

/** A snapshot for the admin "download backup" button. */
export function backupBuffer(): Buffer {
  const tmp = join(tmpdir(), `hearth-backup-${process.pid}.db`)
  rmSync(tmp, { force: true })
  getDb().exec(`vacuum into '${tmp}'`)
  const buf = readFileSync(tmp)
  rmSync(tmp, { force: true })
  return buf
}
