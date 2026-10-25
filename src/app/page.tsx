import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Directory({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const t = await getTranslations('common')
  const sb = await supabaseServer()
  let query = sb.from('community').select('slug,name,city,about').eq('status', 'live').order('name')
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,]/g, '')}%,city.ilike.%${q.replace(/[%,]/g, '')}%`)
  const { data: communities } = await query
  return (
    <main>
      <h1>{t('directory')}</h1>
      <form><input name="q" defaultValue={q} placeholder={t('search')} aria-label={t('search')} /></form>
      <div className="grid">
        {(communities ?? []).map((c) => (
          <Link key={c.slug} href={`/c/${c.slug}`} className="card">
            <h2>{c.name}</h2><p className="muted">{c.city}</p><p>{c.about}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
