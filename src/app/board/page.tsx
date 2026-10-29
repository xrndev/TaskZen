import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { tasks as tasksTable, user } from '@/db/schema';
import { KanbanBoard } from '@/components/KanbanBoard';
import { db } from '@/server/db';
import { profileColumns } from '@/server/services/common';
import { listTags } from '@/server/services/tags';
import { listColumns } from '@/server/services/columns';
import { listTasks } from '@/server/services/tasks';
import { listMembers, listTeams } from '@/server/services/teams';
import { requireUser } from '@/server/session';

export const metadata: Metadata = { title: 'Tablero', robots: { index: false, follow: false } };

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BoardPage(props: { searchParams: Promise<{ team?: string; task?: string }> }) {
  const { team: requested, task: requestedTask } = await props.searchParams;
  const { id } = await requireUser();

  const [[me], teams] = await Promise.all([
    db.select(profileColumns).from(user).where(eq(user.id, id)),
    listTeams(db, id),
  ]);
  // Sin perfil no hay sesión válida (usuario borrado con cookie viva).
  if (!me) redirect('/login');

  // Solo se respeta ?team= si el usuario es miembro (viene de aceptar una invitación).
  let teamId = teams.find(t => t.id === requested)?.id ?? null;
  // Al tocar un aviso se abre /board?task=<id>: solo si la tarea es de un equipo del que eres miembro.
  let openTaskId: string | null = null;
  if (requestedTask && UUID.test(requestedTask)) {
    const [row] = await db.select({ team_id: tasksTable.team_id }).from(tasksTable).where(eq(tasksTable.id, requestedTask));
    if (row && teams.some(t => t.id === row.team_id)) {
      teamId = row.team_id;
      openTaskId = requestedTask;
    }
  }
  teamId ??= teams[0]?.id ?? null;
  const [tasks, members, tags, columns] = teamId
    ? await Promise.all([listTasks(db, id, teamId), listMembers(db, id, teamId), listTags(db, id, teamId), listColumns(db, id, teamId)])
    : [[], [], [], []];

  return (
    <main className="min-h-dvh bg-background text-on-surface font-sans">
      <KanbanBoard initial={{ me, teams, teamId, tasks, members, tags, columns, openTaskId }} />
    </main>
  );
}
