import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { user } from '@/db/schema';
import { KanbanBoard } from '@/components/KanbanBoard';
import { db } from '@/server/db';
import { profileColumns } from '@/server/services/common';
import { listTags } from '@/server/services/tags';
import { listTasks } from '@/server/services/tasks';
import { listMembers, listTeams } from '@/server/services/teams';
import { requireUser } from '@/server/session';

export const dynamic = 'force-dynamic';

export default async function BoardPage(props: { searchParams: Promise<{ team?: string }> }) {
  const { team: requested } = await props.searchParams;
  const { id } = await requireUser();

  const [[me], teams] = await Promise.all([
    db.select(profileColumns).from(user).where(eq(user.id, id)),
    listTeams(db, id),
  ]);
  // Sin perfil no hay sesión válida (usuario borrado con cookie viva).
  if (!me) redirect('/login');

  // Solo se respeta ?team= si el usuario es miembro (viene de aceptar una invitación).
  const teamId = teams.find(t => t.id === requested)?.id ?? teams[0]?.id ?? null;
  const [tasks, members, tags] = teamId
    ? await Promise.all([listTasks(db, id, teamId), listMembers(db, id, teamId), listTags(db, id, teamId)])
    : [[], [], []];

  return (
    <main className="min-h-screen bg-background text-on-surface font-sans">
      <KanbanBoard initial={{ me, teams, teamId, tasks, members, tags }} />
    </main>
  );
}
