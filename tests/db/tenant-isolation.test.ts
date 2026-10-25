import { beforeAll, describe, expect, it } from 'vitest'
import { asUser, freshDb, type Db } from './harness'

const ids = {
  jsgOwner: '00000000-0000-0000-0000-000000000001',
  kittyOwner: '00000000-0000-0000-0000-000000000002',
  jsgMember: '00000000-0000-0000-0000-000000000003',
  platform: '00000000-0000-0000-0000-000000000009',
}

let db: Db
let jsg: string
let kitty: string

beforeAll(async () => {
  db = await freshDb()
  for (const [k, id] of Object.entries(ids)) {
    await db.query(
      `insert into app_user (id, email, name, is_platform_admin) values ($1,$2,$3,$4)`,
      [id, `${k}@example.test`, k, k === 'platform'],
    )
  }
  const mk = (owner: string, slug: string, type: string) =>
    asUser(db, owner, async () => {
      const r = await db.query<{ id: string }>(
        `insert into community (slug, name, type, owner_id) values ($1,$2,$3,$4) returning id`,
        [slug, slug, type, owner],
      )
      return r.rows[0].id
    })
  jsg = await mk(ids.jsgOwner, 'jsg', 'trust')
  kitty = await mk(ids.kittyOwner, 'kitty-demo', 'unregistered')
  await asUser(db, ids.jsgOwner, () =>
    db.query(`insert into membership (community_id, user_id) values ($1,$2)`, [jsg, ids.jsgMember]),
  )
  // Platform admin approves both communities.
  await asUser(db, ids.platform, () => db.query(`update community set status='live'`))
  await asUser(db, ids.jsgOwner, () =>
    db.query(`insert into audit_log (community_id, actor_id, action) values ($1,$2,'test')`, [jsg, ids.jsgOwner]),
  )
  await asUser(db, ids.kittyOwner, () =>
    db.query(`insert into audit_log (community_id, actor_id, action) values ($1,$2,'test')`, [kitty, ids.kittyOwner]),
  )
})

const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ c: string }>(`select count(*) c from (${sql}) t`, params)).rows[0].c)

describe('tenant isolation', () => {
  it('a community owner cannot read another community\'s memberships or audit log', async () => {
    await asUser(db, ids.jsgOwner, async () => {
      expect(await count(`select * from membership where community_id = $1`, [kitty])).toBe(0)
      expect(await count(`select * from audit_log where community_id = $1`, [kitty])).toBe(0)
      expect(await count(`select * from membership where community_id = $1`, [jsg])).toBe(2)
    })
  })

  it('an owner cannot write into another community', async () => {
    await asUser(db, ids.jsgOwner, async () => {
      await expect(
        db.query(`insert into membership (community_id, user_id) values ($1,$2)`, [kitty, ids.jsgMember]),
      ).rejects.toThrow()
      const r = await db.query(`update community set about='pwned' where id=$1 returning id`, [kitty])
      expect(r.rows).toHaveLength(0)
    })
  })

  it('a plain member sees their community but not its admin data or other members', async () => {
    await asUser(db, ids.jsgMember, async () => {
      expect(await count(`select * from membership`)).toBe(1) // only their own row
      expect(await count(`select * from audit_log`)).toBe(0)
      expect(await count(`select * from app_user where id <> $1`, [ids.jsgMember])).toBe(0)
    })
  })

  it('the directory exposes only live communities to outsiders', async () => {
    await asUser(db, ids.jsgMember, async () => expect(await count(`select * from community`)).toBe(2))
    await asUser(db, ids.platform, () => db.query(`update community set status='suspended' where id=$1`, [kitty]))
    await asUser(db, ids.jsgMember, async () => expect(await count(`select * from community`)).toBe(1))
  })
})

describe('roles, MFA and audit', () => {
  it('blocks admin actions until the session is aal2 (MFA)', async () => {
    await asUser(
      db,
      ids.jsgOwner,
      async () => {
        const r = await db.query(`update community set about='x' where id=$1 returning id`, [jsg])
        expect(r.rows).toHaveLength(0)
        await expect(
          db.query(`insert into membership (community_id, user_id, roles) values ($1,$2,'{committee}')`, [jsg, ids.platform]),
        ).rejects.toThrow()
      },
      'aal1',
    )
  })

  it('only the owner can assign roles; committee cannot', async () => {
    await asUser(db, ids.jsgOwner, () =>
      db.query(`update membership set roles='{committee,member}' where community_id=$1 and user_id=$2`, [jsg, ids.jsgMember]),
    )
    await asUser(db, ids.jsgMember, async () => {
      const r = await db.query(`update membership set roles='{owner}' where user_id=$1 returning id`, [ids.jsgMember])
      expect(r.rows).toHaveLength(0)
    })
  })

  it('only a platform admin can change community status; slug and owner are immutable', async () => {
    await asUser(db, ids.jsgOwner, async () => {
      await expect(db.query(`update community set status='suspended' where id=$1`, [jsg])).rejects.toThrow()
      await expect(db.query(`update community set slug='hijack' where id=$1`, [jsg])).rejects.toThrow()
    })
  })

  it('audit log is append-only and cannot be forged for another actor', async () => {
    await asUser(db, ids.jsgOwner, async () => {
      // No UPDATE/DELETE policy exists, so RLS matches zero rows for app users.
      expect((await db.query(`update audit_log set action='x' returning id`)).rows).toHaveLength(0)
      expect((await db.query(`delete from audit_log returning id`)).rows).toHaveLength(0)
      await expect(
        db.query(`insert into audit_log (community_id, actor_id, action) values ($1,$2,'forged')`, [jsg, ids.kittyOwner]),
      ).rejects.toThrow()
    })
  })

  it('the append-only trigger also stops privileged roles', async () => {
    await expect(db.query(`delete from audit_log`)).rejects.toThrow(/append-only/)
  })

  it('a new community starts pending and its founder becomes owner', async () => {
    await asUser(db, ids.jsgMember, async () => {
      const c = await db.query<{ id: string; status: string }>(
        `insert into community (slug, name, type, owner_id, status) values ('fresh','Fresh','society',$1,'live') returning id, status`,
        [ids.jsgMember],
      )
      expect(c.rows[0].status).toBe('pending')
      const m = await db.query<{ roles: string[] }>(`select roles from membership where community_id=$1`, [c.rows[0].id])
      expect(m.rows[0].roles).toContain('owner')
    })
  })
})
