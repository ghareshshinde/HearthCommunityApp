import { rmSync } from 'node:fs'
export default function reset() {
  for (const f of ['./data/e2e.db', './data/e2e.db-wal', './data/e2e.db-shm']) rmSync(f, { force: true })
}
