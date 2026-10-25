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
  addColumn(db, 'participant', 'skills', "text not null default ''")
  addColumn(db, 'participant', 'waitlist', "text not null default '[]'")
  addColumn(db, 'participant', 'source', "text not null default 'online'")
  addColumn(db, 'participant', 'checked_in_at', 'text')
  addColumn(db, 'participant', 'checked_in_by', 'text')
  addColumn(db, 'participant', 'checked_in_gate', 'text')
  addColumn(db, 'registration', 'source', "text not null default 'online'")
  addColumn(db, 'registration', 'rejected', 'integer not null default 0')
  addColumn(db, 'registration', 'decision_note', "text not null default ''")
  addColumn(db, 'registration', 'decided_by', 'text')
  addColumn(db, 'registration', 'decided_at', 'text')
  addColumn(db, 'registration', 'submission_key', 'text')
  addColumn(db, 'outbox', 'attempts', 'integer not null default 0')
  addColumn(db, 'outbox', 'error', 'text')
  db.exec('create unique index if not exists registration_submission on registration(community_id, event_id, submission_key) where submission_key is not null')
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
