/**
 * Real-PostgreSQL validation for the SavdoPilot AI backend.
 *
 * Starts a throwaway PostgreSQL cluster from the `embedded-postgres` binaries
 * (temp data directory, random loopback port, deleted on exit), applies
 * `supabase/migrations/*.sql` in order as the superuser, then runs structural,
 * privilege, RLS and functional checks against the real server.
 *
 * It never reads DATABASE_URL, SUPABASE_URL or any credential: the only target
 * is the cluster this process created, and no network address is printed.
 *
 * Run with `npm run test:db`.
 */
import assert from 'node:assert/strict'
import net from 'node:net'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import EmbeddedPostgres from 'embedded-postgres'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DB = 'savdopilot_test'
const MIGRATIONS = ['0001_init.sql', '0002_rls.sql', '0003_functions.sql', '0004_hardening.sql']

const TABLES = [
  'ai_interactions',
  'conversations',
  'customers',
  'invoice_items',
  'invoices',
  'leads',
  'organization_members',
  'organizations',
  'payments',
  'sales',
  'subscriptions',
  'usage_records',
  'users',
]

const EXPECTED_FKS = {
  'ai_interactions.ai_interactions_organization_id_fkey': 'organizations',
  'ai_interactions.ai_interactions_user_id_fkey': 'users',
  'conversations.conversations_customer_id_fkey': 'customers',
  'conversations.conversations_organization_id_fkey': 'organizations',
  'customers.customers_organization_id_fkey': 'organizations',
  'invoice_items.invoice_items_invoice_id_fkey': 'invoices',
  'invoices.invoices_customer_id_fkey': 'customers',
  'invoices.invoices_customer_same_org': 'customers',
  'invoices.invoices_organization_id_fkey': 'organizations',
  'leads.leads_organization_id_fkey': 'organizations',
  'organization_members.organization_members_organization_id_fkey': 'organizations',
  'organization_members.organization_members_user_id_fkey': 'users',
  'payments.payments_invoice_id_fkey': 'invoices',
  'payments.payments_organization_id_fkey': 'organizations',
  'sales.sales_customer_id_fkey': 'customers',
  'sales.sales_organization_id_fkey': 'organizations',
  'subscriptions.subscriptions_organization_id_fkey': 'organizations',
  'usage_records.usage_records_organization_id_fkey': 'organizations',
}

const EXPECTED_INDEXES = [
  // 0001
  'organization_members_user_idx',
  'customers_org_created_idx',
  'leads_org_created_idx',
  'conversations_org_created_idx',
  'sales_org_sold_idx',
  'invoices_org_created_idx',
  'invoices_org_status_idx',
  'invoice_items_invoice_idx',
  'payments_invoice_idx',
  'usage_records_org_created_idx',
  'ai_interactions_org_created_idx',
  // 0004
  'invoices_customer_idx',
  'sales_customer_idx',
  'conversations_customer_idx',
  'ai_interactions_user_idx',
  'payments_organization_id_idx',
  'customers_organization_id_id_key',
]

// The seven queries of BACKEND_SETUP.md §4.4, executed verbatim. A check below
// asserts each one still appears in the document, so the two cannot drift.
const SECTION_44 = [
  `select relname, relrowsecurity as enabled, relforcerowsecurity as forced
   from pg_class
   where relnamespace = 'public'::regnamespace and relkind = 'r'
   order by relname;`,
  `select schemaname, tablename, policyname from pg_policies where schemaname = 'public';`,
  `select c.relname,
          has_table_privilege('anon', c.oid, 'select') as anon_select,
          has_table_privilege('authenticated', c.oid, 'select') as authenticated_select
   from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
   order by c.relname;`,
  `select count(*) as tables_service_role_can_read
   from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
     and has_table_privilege('service_role', c.oid, 'select');`,
  `select p.proname,
          pg_get_function_identity_arguments(p.oid) as args,
          p.prosecdef as security_definer,
          has_function_privilege('anon', p.oid, 'execute') as anon_execute,
          has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
          has_function_privilege('service_role', p.oid, 'execute') as service_role_execute
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('bootstrap_account', 'create_invoice_with_items', 'record_payment')
   order by p.proname;`,
  `select p.proname, p.proconfig
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.prosecdef
   order by p.proname;`,
  `select c.conrelid::regclass as table_name,
          c.conname,
          (select string_agg(a.attname, ', ' order by k.ord)
             from unnest(c.conkey) with ordinality as k(attnum, ord)
             join pg_attribute a
               on a.attrelid = c.conrelid and a.attnum = k.attnum) as child_columns
   from pg_constraint c
   where c.contype = 'f'
     and not exists (
       select 1
       from pg_index i
       where i.indrelid = c.conrelid
         and i.indisvalid
         and i.indpred is null        -- a partial index cannot serve the check
         -- indkey is an int2vector: element 0 is the index's first column
         and i.indkey[0] = c.conkey[1]
     )
   order by 1, 2;`,
]

const results = []
async function test(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`ok   ${name}`)
  } catch (error) {
    const first = String(error?.message ?? error).split('\n')[0]
    results.push({ name, ok: false, detail: first })
    console.log(`FAIL ${name}\n     ${first}`)
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

const pg = new EmbeddedPostgres({
  databaseDir: path.join(root, '.freebuff', `pgdata-${Date.now()}`),
  user: 'postgres',
  password: 'postgres',
  port: await freePort(),
  persistent: false,
})

let client
const otherClients = []

const one = async (sql, params) => (await client.query(sql, params)).rows[0]
const many = async (sql, params) => (await client.query(sql, params)).rows

/**
 * Runs `fn` inside a transaction that is always rolled back, so tests may grant
 * privileges or create probe tables without leaving anything behind.
 */
async function inRolledBackTransaction(fn) {
  await client.query('begin')
  try {
    return await fn()
  } finally {
    await client.query('rollback')
  }
}

async function applyMigrations() {
  for (const file of MIGRATIONS) {
    const sql = await readFile(path.join(root, 'supabase', 'migrations', file), 'utf8')
    const started = Date.now()
    await client.query(sql)
    console.log(`     applied ${file} in ${Date.now() - started} ms`)
  }
}

async function main() {
  console.log('target: disposable embedded PostgreSQL (no external database, no credentials)\n')
  await pg.initialise()
  await pg.start()
  await pg.createDatabase(DB)

  client = pg.getPgClient(DB)
  await client.connect()

  const version = (await one('show server_version')).server_version
  console.log(`PostgreSQL ${version}\n`)

  // Supabase-compatible roles and grants, so the migrations run under the same
  // assumptions they will meet in the hosted project. Local throwaway cluster only.
  await client.query(`
    create role anon nologin noinherit;
    create role authenticated nologin noinherit;
    create role service_role nologin noinherit bypassrls;
    grant all on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `)
  await applyMigrations()
  console.log('')

  // ---------------------------------------------------------------- structure
  await test('all 13 tables exist', async () => {
    const rows = await many(`
      select relname from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'r'
      order by relname`)
    assert.deepEqual(rows.map((row) => row.relname), TABLES)
  })

  await test('RLS is enabled and forced on all 13 tables', async () => {
    const rows = await many(`
      select relname, relrowsecurity, relforcerowsecurity from pg_class
      where relnamespace = 'public'::regnamespace and relkind = 'r'`)
    assert.equal(rows.length, 13)
    for (const row of rows) {
      assert.equal(row.relrowsecurity, true, `${row.relname} RLS not enabled`)
      assert.equal(row.relforcerowsecurity, true, `${row.relname} RLS not forced`)
    }
  })

  await test('no RLS policies exist (default deny)', async () => {
    const rows = await many(`select * from pg_policies where schemaname = 'public'`)
    assert.equal(rows.length, 0)
  })

  await test('all 18 expected foreign keys exist with the right parent', async () => {
    const rows = await many(`
      select c.conname, c.conrelid::regclass::text as child, c.confrelid::regclass::text as parent
      from pg_constraint c
      where c.contype = 'f'
        and c.conrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)`)
    const actual = Object.fromEntries(rows.map((row) => [`${row.child}.${row.conname}`, row.parent]))
    assert.deepEqual(actual, EXPECTED_FKS)
  })

  await test('the composite invoice → customer FK covers both columns', async () => {
    const row = await one(`
      select cardinality(conkey) as cols, array_length(confkey, 1) as parent_cols
      from pg_constraint
      where conname = 'invoices_customer_same_org' and conrelid = 'public.invoices'::regclass`)
    assert.equal(row.cols, 2)
    assert.equal(row.parent_cols, 2)
  })

  await test('all 17 expected named indexes exist', async () => {
    const rows = await many(`select indexname from pg_indexes where schemaname = 'public'`)
    const names = new Set(rows.map((row) => row.indexname))
    for (const index of EXPECTED_INDEXES) assert.ok(names.has(index), `missing index ${index}`)
  })

  // --------------------------------------------------------------- privileges
  await test('anon and authenticated hold no table privileges', async () => {
    const rows = await many(`
      select c.relname,
             has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger') as anon_any,
             has_table_privilege('authenticated', c.oid, 'select,insert,update,delete,truncate,references,trigger') as auth_any
      from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
      order by c.relname`)
    assert.equal(rows.length, 13)
    for (const row of rows) {
      assert.equal(row.anon_any, false, `anon can touch ${row.relname}`)
      assert.equal(row.auth_any, false, `authenticated can touch ${row.relname}`)
    }
  })

  await test('service_role can read all 13 tables', async () => {
    const row = await one(`
      select count(*)::int as n from pg_class c
      where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
        and has_table_privilege('service_role', c.oid, 'select')`)
    assert.equal(row.n, 13)
  })

  await test('anon and authenticated cannot create objects in schema public', async () => {
    const row = await one(`
      select has_schema_privilege('anon', 'public', 'create') as anon,
             has_schema_privilege('authenticated', 'public', 'create') as auth`)
    assert.equal(row.anon, false)
    assert.equal(row.auth, false)
  })

  await test('tables created after the migrations start with no anon grants', async () => {
    await inRolledBackTransaction(async () => {
      await client.query('create table public.__probe (id int)')
      const row = await one(`
        select has_table_privilege('anon', 'public.__probe', 'select') as anon,
               has_table_privilege('authenticated', 'public.__probe', 'select') as auth`)
      assert.equal(row.anon, false)
      assert.equal(row.auth, false)
    })
  })

  await test('the three functions are SECURITY DEFINER and executable only by service_role', async () => {
    const rows = await many(`
      select p.proname, p.prosecdef,
             has_function_privilege('anon', p.oid, 'execute') as anon_execute,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
             has_function_privilege('service_role', p.oid, 'execute') as service_role_execute
      from pg_proc p
      where p.pronamespace = 'public'::regnamespace
        and p.proname in ('bootstrap_account', 'create_invoice_with_items', 'record_payment')
      order by p.proname`)
    assert.deepEqual(
      rows.map((row) => row.proname),
      ['bootstrap_account', 'create_invoice_with_items', 'record_payment'],
    )
    for (const row of rows) {
      assert.equal(row.prosecdef, true, `${row.proname} is not SECURITY DEFINER`)
      assert.equal(row.anon_execute, false, `anon can execute ${row.proname}`)
      assert.equal(row.authenticated_execute, false, `authenticated can execute ${row.proname}`)
      assert.equal(row.service_role_execute, true, `service_role cannot execute ${row.proname}`)
    }
  })

  await test('every SECURITY DEFINER function pins search_path to public, pg_temp', async () => {
    const rows = await many(`
      select p.proname, p.proconfig from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.prosecdef
      order by p.proname`)
    assert.equal(rows.length, 3)
    for (const row of rows) {
      assert.ok(
        Array.isArray(row.proconfig) && row.proconfig.includes('search_path=public, pg_temp'),
        `${row.proname} proconfig = ${JSON.stringify(row.proconfig)}`,
      )
    }
  })

  await test('anon and authenticated cannot execute record_payment at runtime', async () => {
    for (const role of ['anon', 'authenticated']) {
      await inRolledBackTransaction(async () => {
        await client.query(`set local role ${role}`)
        await assert.rejects(
          client.query(`select public.record_payment('click', 'probe', gen_random_uuid(), 1, 'UZS', 'pending', '{}'::jsonb)`),
          (error) => error.code === '42501',
          `${role} executed record_payment`,
        )
      })
    }
  })

  await test('a granted SELECT still returns no rows without a policy', async () => {
    await inRolledBackTransaction(async () => {
      await client.query('grant select on public.invoices to authenticated')
      await client.query('set local role authenticated')
      const row = await one('select count(*)::int as n from public.invoices')
      assert.equal(row.n, 0)
    })
  })

  await test('anon is denied at the privilege layer, not just by RLS', async () => {
    await inRolledBackTransaction(async () => {
      await client.query('set local role anon')
      await assert.rejects(
        client.query('select count(*) from public.invoices'),
        (error) => error.code === '42501',
      )
    })
  })

  await test('runtime RLS denial: anon without grants is refused on every protected table', async () => {
    for (const table of TABLES) {
      // One transaction per table: the first permission error aborts its
      // transaction, which would hide the next table's real error code.
      await inRolledBackTransaction(async () => {
        await client.query('set local role anon')
        await assert.rejects(
          client.query(`select count(*) from public.${table}`),
          (error) => error.code === '42501',
          `anon read ${table}`,
        )
      })
    }
  })

  await test('runtime RLS denial: even with SELECT granted, anon and authenticated read no rows', async () => {
    await inRolledBackTransaction(async () => {
      const tables = TABLES.map((table) => `public.${table}`).join(', ')
      // Deliberately over-grant to prove the RLS layer holds on its own: RLS is
      // enabled and forced with no policies, so every read must return 0 rows.
      await client.query(`grant select on ${tables} to anon, authenticated`)
      for (const role of ['anon', 'authenticated']) {
        await client.query(`set local role ${role}`)
        for (const table of TABLES) {
          const row = await one(`select count(*)::int as n from public.${table}`)
          assert.equal(row.n, 0, `${role} read rows from ${table}`)
        }
      }
    })
  })

  // ------------------------------------------------------- §4.4 verification
  await test('the seven §4.4 queries match BACKEND_SETUP.md', async () => {
    const doc = await readFile(path.join(root, 'BACKEND_SETUP.md'), 'utf8')
    const block = doc.match(/```sql\n([\s\S]*?)```/)
    assert.ok(block, 'no ```sql block in BACKEND_SETUP.md')
    const normalize = (sql) => sql.replace(/\s+/g, ' ').trim()
    const documentSql = normalize(block[1])
    for (const query of SECTION_44) {
      assert.ok(documentSql.includes(normalize(query)), `§4.4 drifted from the harness: ${query.slice(0, 60)}…`)
    }
  })

  await test('§4.4 #1: 13 tables, RLS enabled and forced', async () => {
    const rows = await client.query(SECTION_44[0]).then((result) => result.rows)
    assert.equal(rows.length, 13)
    for (const row of rows) assert.ok(row.enabled && row.forced, `${row.relname} ${row.enabled}/${row.forced}`)
  })

  await test('§4.4 #2: no policies', async () => {
    const rows = await client.query(SECTION_44[1]).then((result) => result.rows)
    assert.equal(rows.length, 0)
  })

  await test('§4.4 #3: anon and authenticated cannot select any table', async () => {
    const rows = await client.query(SECTION_44[2]).then((result) => result.rows)
    assert.equal(rows.length, 13)
    for (const row of rows) {
      assert.equal(row.anon_select, false, `anon select on ${row.relname}`)
      assert.equal(row.authenticated_select, false, `authenticated select on ${row.relname}`)
    }
  })

  await test('§4.4 #4: service_role reads 13 tables', async () => {
    const row = await client.query(SECTION_44[3]).then((result) => result.rows[0])
    // count(*) is bigint, so node-postgres hands it back as a string.
    assert.equal(Number(row.tables_service_role_can_read), 13)
  })

  await test('§4.4 #5: functions are service_role only', async () => {
    const rows = await client.query(SECTION_44[4]).then((result) => result.rows)
    assert.equal(rows.length, 3)
    for (const row of rows) {
      assert.equal(row.security_definer, true)
      assert.equal(row.anon_execute, false)
      assert.equal(row.authenticated_execute, false)
      assert.equal(row.service_role_execute, true)
    }
  })

  await test('§4.4 #6: definer functions pin search_path', async () => {
    const rows = await client.query(SECTION_44[5]).then((result) => result.rows)
    assert.equal(rows.length, 3)
    for (const row of rows) assert.ok(row.proconfig.includes('search_path=public, pg_temp'), row.proname)
  })

  await test('§4.4 #7: every foreign key is covered by an index', async () => {
    const rows = await client.query(SECTION_44[6]).then((result) => result.rows)
    assert.deepEqual(rows.map((row) => `${row.table_name}.${row.conname}`), [])
  })

  // ------------------------------------------------------------- accounts
  const orgA = (await many(`select * from public.bootstrap_account('uid-a', 'a@example.test', 'Alpha')`))[0]
  const orgB = (await many(`select * from public.bootstrap_account('uid-b', 'b@example.test', 'Beta')`))[0]

  await test('bootstrap_account creates user, organization and owner membership', async () => {
    assert.ok(orgA.user_id && orgA.organization_id)
    assert.equal(orgA.role, 'owner')
    assert.notEqual(orgA.organization_id, orgB.organization_id)
    const counts = await one(
      `select (select count(*)::int from public.users where firebase_uid = 'uid-a') as users,
              (select count(*)::int from public.organization_members where user_id = $1) as members`,
      [orgA.user_id],
    )
    assert.equal(counts.users, 1)
    assert.equal(counts.members, 1)
  })

  await test('bootstrap_account is idempotent', async () => {
    const again = (await many(`select * from public.bootstrap_account('uid-a', 'a@example.test', 'Alpha')`))[0]
    assert.equal(again.user_id, orgA.user_id)
    assert.equal(again.organization_id, orgA.organization_id)
    const orgs = await one(
      `select count(*)::int as n from public.organization_members where user_id = $1`,
      [orgA.user_id],
    )
    assert.equal(orgs.n, 1)
  })

  await test('bootstrap_account preserves an assigned role and creates no second organization', async () => {
    // The first call is the legitimate provision for this new user.
    const user = (await many(`select * from public.bootstrap_account('uid-keep', 'keep@example.test', 'Keep')`))[0]
    const provisioned = await one(`select count(*)::int as n from public.organizations`)

    // A role an operator has already assigned must survive later sign-ins.
    await client.query(`update public.organization_members set role = 'viewer' where user_id = $1`, [
      user.user_id,
    ])

    const again = (await many(`select * from public.bootstrap_account('uid-keep', 'keep@example.test', 'Keep')`))[0]
    assert.equal(again.organization_id, user.organization_id)
    assert.equal(again.role, 'viewer')

    const counts = await one(
      `select (select count(*)::int from public.organization_members where user_id = $1) as members,
              (select count(*)::int from public.organizations) as orgs`,
      [user.user_id],
    )
    assert.equal(counts.members, 1)
    assert.equal(counts.orgs, provisioned.n, 'a second organization was created')
  })

  await test('organization_members refuses a duplicate membership', async () => {
    const user = (await many(`select * from public.bootstrap_account('uid-dup', 'dup@example.test', 'Dup')`))[0]
    const membership = await one(
      `select organization_id from public.organization_members where user_id = $1`,
      [user.user_id],
    )
    await assert.rejects(
      client.query(
        `insert into public.organization_members (organization_id, user_id, role)
         values ($1, $2, 'admin')`,
        [membership.organization_id, user.user_id],
      ),
      (error) => error.code === '23505',
    )
    const after = await one(`select role from public.organization_members where user_id = $1`, [
      user.user_id,
    ])
    assert.equal(after.role, 'owner', 'a duplicate insert must not change the role')
  })

  await test('a new user is not added to an existing organization', async () => {
    const user = (await many(`select * from public.bootstrap_account('uid-solo', 'solo@example.test', 'Solo')`))[0]
    assert.notEqual(user.organization_id, orgA.organization_id)
    const members = await many(
      `select user_id from public.organization_members where organization_id = $1`,
      [orgA.organization_id],
    )
    assert.equal(members.length, 1)
    assert.equal(members[0].user_id, orgA.user_id)
  })

  await test('bootstrap_account survives two concurrent first sign-ins', async () => {
    const second = pg.getPgClient(DB)
    otherClients.push(second)
    await second.connect()
    const call = `select * from public.bootstrap_account('uid-race', 'race@example.test', 'Race')`
    const [first, other] = await Promise.all([client.query(call), second.query(call)])
    assert.equal(first.rows[0].organization_id, other.rows[0].organization_id)
    const counts = await one(
      `select (select count(*)::int from public.users where firebase_uid = 'uid-race') as users,
              (select count(*)::int from public.organization_members where user_id = $1) as members,
              (select count(*)::int from public.organizations where id = $2) as orgs`,
      [first.rows[0].user_id, first.rows[0].organization_id],
    )
    assert.deepEqual(counts, { users: 1, members: 1, orgs: 1 })
  })

  // ------------------------------------------------------------- invoices
  const customerA = (
    await client.query(
      `insert into public.customers (organization_id, name) values ($1, 'A customer') returning id`,
      [orgA.organization_id],
    )
  ).rows[0].id
  const customerB = (
    await client.query(
      `insert into public.customers (organization_id, name) values ($1, 'B customer') returning id`,
      [orgB.organization_id],
    )
  ).rows[0].id

  const items = JSON.stringify([
    { description: 'third 1', quantity: 0.333, unitPrice: 1 },
    { description: 'third 2', quantity: 0.333, unitPrice: 1 },
    { description: 'third 3', quantity: 0.333, unitPrice: 1 },
  ])

  const createInvoice = async (organizationId, customerId, number, payload = items) =>
    (
      await client.query(
        `select * from public.create_invoice_with_items($1, $2, $3, 'UZS', null, '2026-12-31', null, $4::jsonb)`,
        [organizationId, customerId, number, payload],
      )
    ).rows[0]

  const invoiceA = await createInvoice(orgA.organization_id, customerA, 'INV-A-1')

  await test('create_invoice_with_items stores subtotal equal to the sum of rounded line totals', async () => {
    const sum = await one(
      `select coalesce(sum(line_total), 0)::text as total from public.invoice_items where invoice_id = $1`,
      [invoiceA.id],
    )
    assert.equal(invoiceA.subtotal, '0.99')
    assert.equal(sum.total, invoiceA.subtotal)
  })

  await test('create_invoice_with_items rejects a customer from another organization', async () => {
    await assert.rejects(
      createInvoice(orgA.organization_id, customerB, 'INV-A-CROSS'),
      (error) => /customer not found in organization/.test(error.message),
    )
    const count = await one(`select count(*)::int as n from public.invoices where number = 'INV-A-CROSS'`)
    assert.equal(count.n, 0)
  })

  await test('the composite FK blocks a cross-tenant invoice even without the function', async () => {
    await assert.rejects(
      client.query(
        `insert into public.invoices (organization_id, customer_id, number, due_date)
         values ($1, $2, 'INV-A-RAW', '2026-12-31')`,
        [orgA.organization_id, customerB],
      ),
      (error) => error.code === '23503' && error.constraint === 'invoices_customer_same_org',
    )
  })

  await test('an invoice of another organization is invisible to an org-scoped read', async () => {
    const invoiceB = await createInvoice(orgB.organization_id, customerB, 'INV-B-1')
    const rows = await many(`select id from public.invoices where id = $1 and organization_id = $2`, [
      invoiceB.id,
      orgA.organization_id,
    ])
    assert.equal(rows.length, 0)
  })

  // ------------------------------------------------------------- payments
  const pay = async (paymentId, status, amount, invoiceId) => {
    const row = await one(
      `select public.record_payment($1, $2, $3, $4, 'UZS', $5, $6::jsonb) as result`,
      ['click', paymentId, invoiceId, amount, status, JSON.stringify({ provider_payment_id: paymentId })],
    )
    return row.result
  }
  const invoiceRow = async (id) =>
    one(`select status, amount_paid, paid_at from public.invoices where id = $1`, [id])

  await test('record_payment: pending → succeeded credits exactly once', async () => {
    const pending = await pay('clk-a-1', 'pending', 0.99, invoiceA.id)
    assert.equal(pending.duplicate, false)
    assert.equal((await invoiceRow(invoiceA.id)).amount_paid, '0.00')

    const duplicatePending = await pay('clk-a-1', 'pending', 0.99, invoiceA.id)
    assert.equal(duplicatePending.duplicate, true)

    const succeeded = await pay('clk-a-1', 'succeeded', 0.99, invoiceA.id)
    assert.equal(succeeded.duplicate, false)
    const settled = await invoiceRow(invoiceA.id)
    assert.equal(settled.amount_paid, '0.99')
    assert.equal(settled.status, 'paid')
    assert.ok(settled.paid_at)
  })

  await test('record_payment: a replayed success does not credit twice', async () => {
    const replay = await pay('clk-a-1', 'succeeded', 0.99, invoiceA.id)
    assert.equal(replay.duplicate, true)
    assert.equal((await invoiceRow(invoiceA.id)).amount_paid, '0.99')
  })

  await test('record_payment: a settled payment cannot be downgraded', async () => {
    const downgrade = await pay('clk-a-1', 'failed', 0.99, invoiceA.id)
    assert.equal(downgrade.state_conflict, true)
    const row = await invoiceRow(invoiceA.id)
    assert.equal(row.status, 'paid')
    assert.equal(row.amount_paid, '0.99')
    const count = await one(`select count(*)::int as n from public.payments where invoice_id = $1`, [invoiceA.id])
    assert.equal(count.n, 1)
  })

  await test('record_payment: failed → succeeded is allowed and credits once', async () => {
    const invoiceB = await createInvoice(orgB.organization_id, customerB, 'INV-B-2')
    const failed = await pay('clk-b-1', 'failed', 0.5, invoiceB.id)
    assert.equal(failed.found, true)
    assert.equal((await invoiceRow(invoiceB.id)).amount_paid, '0.00')

    await pay('clk-b-1', 'succeeded', 0.5, invoiceB.id)
    const partial = await invoiceRow(invoiceB.id)
    assert.equal(partial.amount_paid, '0.50')
    assert.equal(partial.status, 'partial')

    const payment = await one(
      `select organization_id, amount::text as amount from public.payments where provider_payment_id = 'clk-b-1'`,
    )
    assert.equal(payment.organization_id, orgB.organization_id)
    assert.equal(payment.amount, '0.50')
  })

  await test('record_payment: an amount above numeric(14,2) is clamped, not fatal', async () => {
    const invoiceC = await createInvoice(orgA.organization_id, customerA, 'INV-A-CLAMP', JSON.stringify([
      { description: 'one', quantity: 1, unitPrice: 1 },
    ]))
    const result = await pay('clk-c-1', 'succeeded', 1e15, invoiceC.id)
    assert.equal(result.found, true)
    const payment = await one(
      `select amount::text as amount from public.payments where provider_payment_id = 'clk-c-1'`,
    )
    assert.equal(payment.amount, '999999999999.99')
  })

  await test('record_payment: two concurrent identical callbacks credit once', async () => {
    const invoiceD = await createInvoice(orgA.organization_id, customerA, 'INV-A-RACE', JSON.stringify([
      { description: 'one', quantity: 1, unitPrice: 1 },
    ]))
    const second = pg.getPgClient(DB)
    otherClients.push(second)
    await second.connect()
    const call = `select public.record_payment('click', 'clk-d-1', $1, 1, 'UZS', 'succeeded', '{}'::jsonb) as result`
    const [first, other] = await Promise.all([client.query(call, [invoiceD.id]), second.query(call, [invoiceD.id])])
    const duplicateFlags = [first.rows[0].result.duplicate, other.rows[0].result.duplicate].sort()
    assert.deepEqual(duplicateFlags, [false, true])
    const row = await invoiceRow(invoiceD.id)
    assert.equal(row.amount_paid, '1.00')
    assert.equal(row.status, 'paid')
    const count = await one(
      `select count(*)::int as n from public.payments where provider_payment_id = 'clk-d-1'`,
    )
    assert.equal(count.n, 1)
  })

  await test('record_payment: an unknown invoice reports found=false and writes nothing', async () => {
    const before = await one(`select count(*)::int as n from public.payments`)
    const result = await pay('clk-missing', 'succeeded', 1, '00000000-0000-4000-8000-000000000000')
    assert.equal(result.found, false)
    const after = await one(`select count(*)::int as n from public.payments`)
    assert.equal(after.n, before.n)
  })

  await test('cross-tenant payment callback cannot reach another organization\'s invoice', async () => {
    // The API resolves the invoice through an org-filtered query before the RPC;
    // this is that query, run against another tenant's id.
    const invoiceB = await createInvoice(orgB.organization_id, customerB, 'INV-B-3')
    const visible = await many(`select id from public.invoices where id = $1 and organization_id = $2`, [
      invoiceB.id,
      orgA.organization_id,
    ])
    assert.equal(visible.length, 0)
  })
}

let exitCode = 0
try {
  await main()
} catch (error) {
  console.error(`\nharness error: ${error?.stack ?? error}`)
  exitCode = 1
} finally {
  for (const extra of otherClients) await extra.end().catch(() => {})
  if (client) await client.end().catch(() => {})
  await pg.stop().catch(() => {})
}

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) {
  exitCode = 1
  console.log('\nfailures:')
  for (const result of failed) console.log(` - ${result.name}\n   ${result.detail}`)
}
process.exit(exitCode)
