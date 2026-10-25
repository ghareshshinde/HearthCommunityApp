import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { SCHEMA } from './schema'

let db: DatabaseSync | undefined

/** Embedded SQLite (AM3). Path from DATABASE_PATH; ':memory:' in tests. */
export function getDb(): DatabaseSync {
  if (db) return db
  const path = process.env.DATABASE_PATH ?? './data/hearth.db'
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  db = new DatabaseSync(path)
  db.exec('pragma journal_mode = wal; pragma foreign_keys = on;')
  db.exec(SCHEMA)
  addColumn(db, 'participant', 'waitlist', "text not null default '[]'")
  return db
}

export function resetDbForTests() {
  db?.close()
  db = undefined
}

function addColumn(d: DatabaseSync, table: string, column: string, def: string) {
  const cols = d.prepare(`pragma table_info(${table})`).all() as { name: string }[]
  if (!cols.some((c) => c.name === column)) d.exec(`alter table ${table} add column ${column} ${def}`)
}
