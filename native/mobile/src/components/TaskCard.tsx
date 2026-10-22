import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '@/lib/theme'
import type { Task } from '@/lib/types'

export function formatDue(iso: string) {
  return new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export const TaskCard = memo(function TaskCard({ task, now, onPress }: { task: Task; now: number; onPress: (t: Task) => void }) {
  const t = useTheme()
  const overdue = !!task.due_date && task.status !== 'completed' && Date.parse(task.due_date) < now
  const done = task.status === 'completed'

  return (
    <Pressable
      onPress={() => onPress(task)}
      accessibilityRole="button"
      accessibilityLabel={task.title}
      style={({ pressed }) => [styles.card, { backgroundColor: pressed ? t.cardHigh : t.card, borderColor: t.border }]}
    >
      <Text style={[styles.title, { color: done ? t.textMuted : t.text, textDecorationLine: done ? 'line-through' : 'none' }]}>{task.title}</Text>
      {!!task.description && <Text numberOfLines={2} style={[styles.desc, { color: t.textMuted }]}>{task.description}</Text>}

      {!!task.tags?.length && (
        <View style={styles.tags}>
          {task.tags.map((tag) => (
            <View key={tag.id} style={[styles.tag, { borderColor: tag.color }]}>
              <Text style={[styles.tagText, { color: tag.color }]}>{tag.name}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.meta}>
        {!!task.due_date && <Text style={{ color: overdue ? t.error : t.textMuted, fontWeight: overdue ? '700' : '400', fontSize: 13 }}>{overdue ? 'Vencida · ' : 'Vence · '}{formatDue(task.due_date)}</Text>}
        {(task.comment_count ?? 0) > 0 && <Text style={{ color: t.textMuted, fontSize: 13 }}>{task.comment_count} comentarios</Text>}
        {!!task.assignee?.full_name && <Text style={{ color: t.textMuted, fontSize: 13, marginLeft: 'auto' }}>{task.assignee.full_name}</Text>}
      </View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  desc: { fontSize: 14, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 12, fontWeight: '600' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' },
})
