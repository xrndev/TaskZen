// Concede, quita o lista planes a mano mientras no hay pagos en línea. JavaScript plano: se ejecuta también dentro de la
// imagen `migrate` (tiene `pg` y esta carpeta), sin exponer la base de datos.
//
//   node --env-file=.env.local scripts/plan.mjs list
//   node --env-file=.env.local scripts/plan.mjs user  <correo> <plan> [días]    (sin días = sin caducidad)
//   node --env-file=.env.local scripts/plan.mjs team  <id-del-equipo> <plan> [días]
//   node --env-file=.env.local scripts/plan.mjs quitar user <correo>   |   quitar team <id-del-equipo>
//
// Planes personales: user_plus, user_pro. Planes de equipo: team_plus, team_pro.
// En la VPS:  cd /opt/taskzen && docker compose run --rm migrate node scripts/plan.mjs list
import pg from 'pg'

const USER_PLANS = ['user_plus', 'user_pro']
const TEAM_PLANS = ['team_plus', 'team_pro']

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL no está definida.')
  process.exit(1)
}
const [cmd, a, b, c, d] = process.argv.slice(2)
const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  if (cmd === 'list') {
    const { rows } = await client.query(`
      select coalesce(u.email, 'equipo: ' || t.name || ' (' || t.id || ')') as dueno, s.plan, s.status, s.ends_at, s.provider
      from subscriptions s
      left join "user" u on u.id = s.user_id
      left join teams t on t.id = s.team_id
      order by s.created_at`)
    console.table(rows)
  } else if (cmd === 'user' || cmd === 'team') {
    const [target, plan, days] = [a, b, c]
    const allowed = cmd === 'user' ? USER_PLANS : TEAM_PLANS
    if (!target || !allowed.includes(plan)) fail(`Uso: ${cmd} <${cmd === 'user' ? 'correo' : 'id-del-equipo'}> <${allowed.join('|')}> [días]`)
    const n = days === undefined ? null : Number(days)
    if (n !== null && (!Number.isFinite(n) || n <= 0)) fail('Los días deben ser un número positivo.')
    const endsAt = n === null ? null : new Date(Date.now() + n * 86_400_000).toISOString()

    const owner = cmd === 'user'
      ? (await client.query(`select id from "user" where email = $1`, [target.toLowerCase()])).rows[0]?.id
      : (await client.query(`select id from teams where id::text = $1 and is_personal = false`, [target])).rows[0]?.id
    if (!owner) fail(cmd === 'user' ? `No existe ninguna cuenta con el correo ${target}.` : `No existe ningún equipo con id ${target} (el espacio personal no admite plan de equipo).`)

    const col = cmd === 'user' ? 'user_id' : 'team_id'
    await client.query(
      `insert into subscriptions(${col}, plan, status, ends_at, provider) values ($1, $2, 'active', $3, 'manual')
       on conflict (${col}) where ${col} is not null
       do update set plan = excluded.plan, status = 'active', ends_at = excluded.ends_at, provider = 'manual', updated_at = now()`,
      [owner, plan, endsAt],
    )
    console.log(`Plan ${plan} concedido a ${target}${endsAt ? ` hasta ${endsAt}` : ' sin caducidad'}.`)
  } else if (cmd === 'quitar' && (a === 'user' || a === 'team')) {
    const target = b
    if (!target) fail(`Uso: quitar ${a} <${a === 'user' ? 'correo' : 'id-del-equipo'}>`)
    const res = a === 'user'
      ? await client.query(`delete from subscriptions where user_id = (select id from "user" where email = $1)`, [target.toLowerCase()])
      : await client.query(`delete from subscriptions where team_id::text = $1`, [target])
    console.log(res.rowCount ? 'Plan quitado.' : 'No había ningún plan que quitar.')
    void c; void d
  } else {
    fail('Uso: list | user <correo> <plan> [días] | team <id> <plan> [días] | quitar user <correo> | quitar team <id>')
  }
} finally {
  await client.end()
}
