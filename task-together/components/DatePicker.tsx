// Inline-Datepicker als Monatsgrid, gleiche Darstellung wie Kalender-Tab

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/design';

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface DatePickerProps {
  value: Date | null; // null = keine Deadline
  onChange: (date: Date | null) => void;
}

export default function DatePicker({ value, onChange }: DatePickerProps) {
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDay = now.getDate();

  const [viewYear, setViewYear] = useState(value?.getFullYear() ?? todayYear);
  const [viewMonth, setViewMonth] = useState(value?.getMonth() ?? todayMonth);
  const [cellSize, setCellSize] = useState(0);

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const selectedYear = value?.getFullYear() ?? null;
  const selectedMonth = value?.getMonth() ?? null;
  const selectedDay = value?.getDate() ?? null;

  const innerSize = cellSize > 0 ? Math.floor(cellSize * 0.76) : 0;

  const canGoPrev = viewYear > todayYear || (viewYear === todayYear && viewMonth > todayMonth);

  function goToPrevMonth() {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  }

  function goToNextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  }

  const formattedValue = value
    ? `${value.getDate().toString().padStart(2, '0')}.${(value.getMonth() + 1).toString().padStart(2, '0')}.${value.getFullYear()}`
    : null;

  return (
    <View style={styles.container}>
      {/* Ausgewähltes Datum + Entfernen */}
      <View style={styles.selectionRow}>
        <Text style={styles.selectionText}>
          {formattedValue ?? 'Keine Deadline'}
        </Text>
        {value && (
          <TouchableOpacity style={styles.clearButton} onPress={() => onChange(null)}>
            <Text style={styles.clearButtonText}>Entfernen</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Monatsnavigation */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navButton} onPress={goToPrevMonth} disabled={!canGoPrev}>
          <Text style={[styles.navButtonText, !canGoPrev && styles.navButtonDisabled]}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>
        <TouchableOpacity style={styles.navButton} onPress={goToNextMonth}>
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Wochentags-Header */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Grid — onLayout misst die echte Breite für exakte Zellgrößen */}
      <View
        style={styles.grid}
        onLayout={(e) => {
          const w = Math.floor(e.nativeEvent.layout.width);
          setCellSize(Math.floor(w / 7));
        }}
      >
        {cellSize > 0 && grid.map((day, index) => {
          if (day === null) {
            return <View key={`e-${index}`} style={{ width: cellSize, height: cellSize }} />;
          }

          const isToday = viewYear === todayYear && viewMonth === todayMonth && day === todayDay;
          const isSelected = viewYear === selectedYear && viewMonth === selectedMonth && day === selectedDay;
          const isPast = new Date(viewYear, viewMonth, day).getTime() < new Date(todayYear, todayMonth, todayDay).getTime();

          return (
            <TouchableOpacity
              key={`d-${day}`}
              style={[
                { width: cellSize, height: cellSize, justifyContent: 'center', alignItems: 'center' },
                isPast && styles.dayCellPast,
              ]}
              onPress={() => { if (!isPast) onChange(new Date(viewYear, viewMonth, day)); }}
              disabled={isPast}
              activeOpacity={isPast ? 1 : 0.6}
            >
              <View style={[
                { width: innerSize, height: innerSize, borderRadius: BorderRadius.full, justifyContent: 'center', alignItems: 'center' },
                isToday && !isSelected && styles.dayCellInnerToday,
                isSelected && styles.dayCellInnerSelected,
              ]}>
                <Text style={[
                  styles.dayText,
                  isPast && styles.dayTextPast,
                  isToday && !isSelected && styles.dayTextToday,
                  isSelected && styles.dayTextSelected,
                ]}>
                  {day}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  selectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  selectionText: {
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textPrimary,
  },
  clearButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  clearButtonText: {
    fontSize: Typography.sizeSM,
    color: Colors.danger,
    fontWeight: Typography.weightMedium,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  navButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  navButtonText: {
    fontSize: 20,
    color: Colors.primary,
    fontWeight: Typography.weightSemiBold,
  },
  navButtonDisabled: {
    color: Colors.separatorOpaque,
  },
  monthTitle: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textPrimary,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  weekdayText: {
    fontSize: Typography.sizeXS,
    fontWeight: Typography.weightMedium,
    color: Colors.textTertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
  },
  dayCellPast: {
    opacity: 0.3,
  },
  dayCellInnerToday: {
    backgroundColor: Colors.primary + '12',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dayCellInnerSelected: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textPrimary,
  },
  dayTextPast: {
    color: Colors.textTertiary,
  },
  dayTextToday: {
    color: Colors.primary,
    fontWeight: Typography.weightBold,
  },
  dayTextSelected: {
    color: Colors.textOnPrimary,
    fontWeight: Typography.weightBold,
  },
});
