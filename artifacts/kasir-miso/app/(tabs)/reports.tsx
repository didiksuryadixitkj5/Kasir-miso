import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { consignmentIdFromKey, formatRp, isConsignmentKey, isDateInReportPeriod, ReportPeriod, useWarung } from '@/context/WarungContext';
import { useColors } from '@/hooks/useColors';
import { Badge, EmptyState, PageHeader, Screen, SectionHeader, Surface } from '@/components/WarungUI';

type ChartPoint = { date: string; label: string; revenue: number; expense: number };

function localDateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function chartPoints(period: ReportPeriod, sales: ReturnType<typeof useWarung>['sales'], expenses: ReturnType<typeof useWarung>['expenses']): ChartPoint[] {
  const now = new Date();
  const dates: Date[] = [];
  if (period === 'Hari ini') {
    dates.push(now);
  } else if (period === 'Minggu ini') {
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      if (date <= now) dates.push(date);
    }
  } else {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let index = 0; index < now.getDate(); index += 1) {
      dates.push(new Date(first.getFullYear(), first.getMonth(), index + 1));
    }
  }

  return dates.map((date) => {
    const key = localDateKey(date);
    const revenue = sales.filter((sale) => sale.date === key).reduce((sum, sale) => sum + sale.amount, 0);
    const expense = expenses.filter((item) => item.date === key).reduce((sum, item) => sum + item.amount, 0);
    return {
      date: key,
      label: period === 'Bulan ini' ? String(date.getDate()) : date.toLocaleDateString('id-ID', { weekday: 'short' }).replace('.', ''),
      revenue,
      expense,
    };
  });
}

function formatChartAmount(value: number) {
  if (value >= 1000000) return `Rp ${(value / 1000000).toFixed(value % 1000000 ? 1 : 0)} jt`;
  if (value >= 1000) return `Rp ${Math.round(value / 1000)} rb`;
  return `Rp ${value}`;
}

function IncomeExpenseChart({ period, sales, expenses }: { period: ReportPeriod; sales: ReturnType<typeof useWarung>['sales']; expenses: ReturnType<typeof useWarung>['expenses'] }) {
  const c = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const points = chartPoints(period, sales, expenses);
  const chartWidth = Math.max(windowWidth - 62, points.length * (period === 'Bulan ini' ? 31 : 62));
  const chartHeight = 188;
  const plotTop = 15;
  const plotBottom = 143;
  const plotHeight = plotBottom - plotTop;
  const maxValue = Math.max(1, ...points.flatMap((point) => [point.revenue, point.expense]));
  const scale = (value: number) => value ? Math.max(3, (value / maxValue) * plotHeight) : 0;
  const groupWidth = chartWidth / points.length;
  const barWidth = Math.max(5, Math.min(14, groupWidth * 0.24));
  const revenueColor = c.primary;
  const expenseColor = c.accent;
  const ticks = [maxValue, maxValue / 2, 0];

  return (
    <Surface style={s.chartSurface}>
      <View style={s.chartHeader}>
        <View>
          <Text style={[s.chartTitle, { color: c.foreground }]}>Pendapatan vs pengeluaran</Text>
          <Text style={[s.chartCaption, { color: c.mutedForeground }]}>Per hari · {period.toLowerCase()}</Text>
        </View>
        <View style={s.legend}>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: revenueColor }]} /><Text style={[s.legendText, { color: c.mutedForeground }]}>Masuk</Text></View>
          <View style={s.legendItem}><View style={[s.legendDot, { backgroundColor: expenseColor }]} /><Text style={[s.legendText, { color: c.mutedForeground }]}>Keluar</Text></View>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chartScroll}>
        <View>
          <View style={s.yAxisLabels}>
            {ticks.map((tick, index) => <Text key={index} style={[s.yAxisLabel, { color: c.mutedForeground }]}>{formatChartAmount(tick)}</Text>)}
          </View>
          <Svg width={chartWidth} height={chartHeight}>
            {ticks.map((_, index) => {
              const y = plotTop + (plotHeight / 2) * index;
              return <Line key={index} x1="0" y1={y} x2={chartWidth} y2={y} stroke={c.border} strokeWidth="1" strokeDasharray="4 5" />;
            })}
            {points.map((point, index) => {
              const center = groupWidth * index + groupWidth / 2;
              const revenueHeight = scale(point.revenue);
              const expenseHeight = scale(point.expense);
              return (
                <React.Fragment key={point.date}>
                  <Rect x={center - barWidth - 2} y={plotBottom - revenueHeight} width={barWidth} height={revenueHeight} rx="4" fill={revenueColor} />
                  <Rect x={center + 2} y={plotBottom - expenseHeight} width={barWidth} height={expenseHeight} rx="4" fill={expenseColor} />
                  <SvgText x={center} y={166} fill={c.mutedForeground} fontSize="10" textAnchor="middle">{point.label}</SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        </View>
      </ScrollView>
      {!points.some((point) => point.revenue || point.expense) ? <Text style={[s.chartEmpty, { color: c.mutedForeground }]}>Belum ada data pada periode ini.</Text> : null}
    </Surface>
  );
}

export default function ReportsScreen() {
  const c = useColors();
  const { menus, consignments, sales, expenses, inventory, savingsEntries } = useWarung();
  const [period, setPeriod] = useState<ReportPeriod>('Hari ini');
  const periodSales = sales.filter((sale) => isDateInReportPeriod(sale.date, period));
  const periodExpenses = expenses.filter((expense) => isDateInReportPeriod(expense.date, period));
  const cash = periodSales.filter((sale) => sale.method === 'Tunai').reduce((sum, sale) => sum + sale.amount, 0);
  const qris = periodSales.filter((sale) => sale.method === 'QRIS').reduce((sum, sale) => sum + sale.amount, 0);
  const revenue = cash + qris;
  const costs = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const periodSavings = savingsEntries.filter((entry) => isDateInReportPeriod(entry.date, period));
  const savingsTotal = periodSavings.reduce((sum, entry) => sum + entry.amount, 0);
  const remainingAfterSavings = revenue - costs - savingsTotal;
  const savingBreakdown = Object.entries(periodSavings.reduce<Record<string, { name: string; stockName: string; qty: number; amount: number }>>((result, entry) => {
    const key = `${entry.name}:${entry.inventoryId}`;
     const stock = inventory.find((item) => item.id === entry.inventoryId);
     const current = result[key] || { name: entry.name, stockName: entry.inventoryId ? stock?.name || 'Bahan dihapus' : 'Penyisihan manual', qty: 0, amount: 0 };
    current.qty += entry.qty;
    current.amount += entry.amount;
    result[key] = current;
    return result;
  }, {}));
  const best = Object.entries(periodSales.flatMap((sale) => sale.items).reduce<Record<string, number>>((result, item) => { result[item.menu] = (result[item.menu] || 0) + item.qty; return result; }, {})).sort((a, b) => b[1] - a[1]);
  const periods: ReportPeriod[] = ['Hari ini', 'Minggu ini', 'Bulan ini'];
  return (
    <Screen>
      <PageHeader eyebrow="Owner view" title="Laporan warung" subtitle="Lihat uang masuk dan menu yang paling dicari." />
      <View style={s.periods}>{periods.map((item) => <Pressable key={item} onPress={() => setPeriod(item)} style={({ pressed }) => [s.period, { backgroundColor: period === item ? c.primary : c.card, borderColor: period === item ? c.primary : c.border, opacity: pressed ? 0.7 : 1 }]}><Text style={[s.periodText, { color: period === item ? c.primaryForeground : c.mutedForeground }]}>{item}</Text></Pressable>)}</View>
      <Surface tone="ink" style={s.profit}><Text style={[s.profitLabel, { color: c.mutedForeground }]}>UNTUNG BERSIH · {period.toUpperCase()}</Text><Text style={[s.profitValue, { color: c.card }]}>{formatRp(revenue - costs)}</Text><Text style={[s.profitSub, { color: c.mutedForeground }]}>{formatRp(revenue)} penjualan  −  {formatRp(costs)} biaya</Text></Surface>
       <SectionHeader title="Penyisihan dana" meta={formatRp(savingsTotal)} icon="wallet-outline" />
       <Surface style={s.savingsSummary}>
         <View style={s.savingsSummaryRow}><View><Text style={[s.metricLabel, { color: c.mutedForeground }]}>TOTAL DISISIHKAN</Text><Text style={[s.savingsValue, { color: c.primary }]}>{formatRp(savingsTotal)}</Text></View><View style={s.savingsSummaryRight}><Text style={[s.metricLabel, { color: c.mutedForeground }]}>UANG TERSISA</Text><Text style={[s.savingsValue, { color: remainingAfterSavings >= 0 ? c.foreground : c.destructive }]}>{formatRp(remainingAfterSavings)}</Text></View></View>
         {!savingBreakdown.length ? <Text style={[s.chartEmpty, { color: c.mutedForeground }]}>Belum ada penyisihan pada periode ini.</Text> : savingBreakdown.map(([key, item]) => <View key={key} style={[s.savingRow, { borderTopColor: c.border }]}><View style={s.flex}><Text style={[s.bestName, { color: c.foreground }]}>{item.name}</Text><Text style={[s.chartCaption, { color: c.mutedForeground }]}>{item.stockName} · {item.qty} satuan bahan</Text></View><Text style={[s.bestQty, { color: c.primary }]}>{formatRp(item.amount)}</Text></View>)}
       </Surface>
      <SectionHeader title="Arus kas" icon="bar-chart-outline" />
      <IncomeExpenseChart period={period} sales={sales} expenses={expenses} />
      <SectionHeader title="Uang masuk" icon="trending-up-outline" />
      <View style={s.grid}><Surface style={s.metric}><Ionicons name="cash-outline" size={20} color={c.primary} /><Text style={[s.metricLabel, { color: c.mutedForeground }]}>Tunai</Text><Text style={[s.metricValue, { color: c.foreground }]}>{formatRp(cash)}</Text></Surface><Surface style={s.metric}><Ionicons name="qr-code-outline" size={20} color={c.primary} /><Text style={[s.metricLabel, { color: c.mutedForeground }]}>QRIS</Text><Text style={[s.metricValue, { color: c.foreground }]}>{formatRp(qris)}</Text></Surface></View>
       <SectionHeader title="Item terlaris" meta={best.length ? `${best.length} item terjual` : undefined} icon="trophy-outline" />
       {!best.length ? <EmptyState icon="bar-chart-outline" title="Belum ada penjualan" body="Ringkasan item terlaris akan muncul setelah nota dibayar." /> : <Surface>{best.slice(0, 4).map(([key, qty], index) => { const name = isConsignmentKey(key) ? 'Titipan' : menus.find((menu) => menu.id === key)?.name; return <View key={key} style={s.best}><Badge tone={index === 0 ? 'accent' : 'muted'}>{index + 1}</Badge><Text style={[s.bestName, { color: c.foreground }]}>{isConsignmentKey(key) ? `${consignments.find((item) => item.id === consignmentIdFromKey(key))?.name || 'Titipan dihapus'} (titipan)` : name || 'Menu dihapus'}</Text><Text style={[s.bestQty, { color: c.primary }]}>{qty} item</Text></View>; })}</Surface>}
    </Screen>
  );
}

const s = StyleSheet.create({
  periods: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  period: { borderWidth: 1, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13 },
  periodText: { fontSize: 11, fontWeight: '800' },
  profit: { marginBottom: 23 },
  profitLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  profitValue: { fontSize: 30, fontWeight: '700', marginTop: 8 },
  profitSub: { fontSize: 11, marginTop: 7 },
  grid: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  metric: { flex: 1, minHeight: 113 },
  metricLabel: { fontSize: 11, marginTop: 13 },
  metricValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  chartSurface: { marginBottom: 22, padding: 15 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  chartTitle: { fontSize: 14, fontWeight: '800' },
  chartCaption: { fontSize: 11, marginTop: 3 },
  legend: { gap: 7, alignItems: 'flex-end' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 3 },
  legendText: { fontSize: 10, fontWeight: '700' },
  chartScroll: { paddingRight: 2 },
  yAxisLabels: { position: 'absolute', left: 0, top: 5, height: 145, justifyContent: 'space-between', zIndex: 1 },
  yAxisLabel: { fontSize: 9, width: 54 },
  chartEmpty: { textAlign: 'center', fontSize: 11, marginTop: -5 },
  best: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  bestName: { flex: 1, fontWeight: '700', fontSize: 13, marginLeft: 10 },
  bestQty: { fontWeight: '800', fontSize: 12 },
  flex: { flex: 1 },
  savingsSummary: { marginBottom: 22 },
  savingsSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  savingsSummaryRight: { alignItems: 'flex-end' },
  savingsValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  savingRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 10, marginTop: 10 },
});