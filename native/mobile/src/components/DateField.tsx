import { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { Calendar, X } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { fmtDate, fmtShort } from '@/lib/dates'
import { alpha, usePalette } from '@/lib/theme'
import { Label, Txt } from './ui'

const two = (n: number) => String(n).padStart(2, '0')

/** `Date` → "YYYY-MM-DD" (fecha local), el formato que usan los filtros. */
export const toDateInput = (d: Date) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
export const fromDateInput = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Abre el selector de fecha y, si `withTime`, después el de hora (diálogos nativos de Android). */
function pick(current: Date, withTime: boolean, done: (d: Date) => void) {
  DateTimePickerAndroid.open({
    value: current,
    mode: 'date',
    onChange: (e, date) => {
      if (e.type !== 'set' || !date) return
      if (!withTime) return done(date)
      DateTimePickerAndroid.open({
        value: date,
        mode: 'time',
        is24Hour: true,
        onChange: (e2, time) => {
          if (e2.type !== 'set' || !time) return
          done(new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes()))
        },
      })
    },
  })
}

/** Campo de fecha (o fecha y hora) con el aspecto de los inputs de la web. */
export function DateField({ label, value, onChange, withTime, placeholder = 'Elegir…' }: { label: string; value: Date | null; onChange: (d: Date | null) => void; withTime?: boolean; placeholder?: string }) {
  const p = usePalette()
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <Pressable
        onPress={() => pick(value ?? new Date(), !!withTime, onChange)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: alpha(p.outline, 0.3), backgroundColor: p.container, paddingLeft: 16, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <Calendar size={18} color={p.onSurfaceVariant} />
        <Txt size={16} color={value ? p.onSurface : alpha(p.onSurfaceVariant, 0.6)} style={{ flex: 1 }}>{value ? (withTime ? fmtShort(value) : fmtDate(value)) : placeholder}</Txt>
        {value && (
          <Pressable onPress={() => onChange(null)} accessibilityRole="button" accessibilityLabel={`Quitar ${label}`} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color={p.onSurfaceVariant} />
          </Pressable>
        )}
      </Pressable>
    </View>
  )
}
