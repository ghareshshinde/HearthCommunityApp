export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { restoreIfMissing } = await import('./lib/persist')
  await restoreIfMissing(process.env.DATABASE_PATH ?? './data/hearth.db')
}
