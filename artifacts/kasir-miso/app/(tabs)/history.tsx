import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { consignmentIdFromKey, formatRp, isConsignmentKey, isDateInReportPeriod, ReportPeriod, useWarung } from '@/context/WarungContext';
import { useColors } from '@/hooks/useColors';
import { Badge, EmptyState, PageHeader, Screen, SectionHeader, Surface } from '@/components/WarungUI';

const periods: ReportPeriod[] = ['Hari ini', 'Minggu ini', 'Bulan ini'];

function formatHistoryDate(value: string) {
  const parts = value.split('-');
  return parts.length === 3 ? parts.reverse().join('/') : value;
}

export default function HistoryScreen() {
  const c = useColors();
  const { menus, consignments, sales } = useWarung();
  const [period, setPeriod] = useState<ReportPeriod>('Hari ini');
  const filteredSales = sales
    .filter((sale) => isDateInReportPeriod(sale.date, period))
    .slice()
    .reverse();
  const total = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);

  return (
    <Screen>
      <PageHeader
        eyebrow="Catatan penjualan"
        title="Riwayat transaksi"
        subtitle="Semua pembayaran yang sudah diterima tersimpan di sini."
      />
      <View style={s.periods}>
        {periods.map((item) => (
          <Pressable
            key={item}
            onPress={() => setPeriod(item)}
            style={({ pressed }) => [
              s.period,
              {
                backgroundColor: period === item ? c.primary : c.card,
                borderColor: period === item ? c.primary : c.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={[s.periodText, { color: period === item ? c.primaryForeground : c.mutedForeground }]}>
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
      <Surface tone="ink" style={s.summary}>
        <View style={[s.summaryIcon, { backgroundColor: c.accent }]}>
          <Ionicons name="receipt-outline" size={21} color={c.accentForeground} />
        </View>
        <View style={s.flex}>
          <Text style={[s.summaryLabel, { color: c.mutedForeground }]}>TOTAL PENJUALAN · {period.toUpperCase()}</Text>
          <Text style={[s.summaryValue, { color: c.card }]}>{formatRp(total)}</Text>
        </View>
        <Badge tone="primary">{filteredSales.length} nota</Badge>
      </Surface>
      <SectionHeader title="Daftar transaksi" meta={filteredSales.length ? 'Terbaru' : undefined} icon="list-outline" />
      {!filteredSales.length ? (
        <EmptyState
          icon="receipt-outline"
          title="Belum ada transaksi"
          body={`Pembayaran pada periode ${period.toLowerCase()} akan muncul di sini.`}
        />
      ) : (
        filteredSales.map((sale) => (
          <Surface key={sale.id} style={s.card}>
            <View style={s.cardTop}>
              <View style={s.dateWrap}>
                <View style={[s.icon, { backgroundColor: c.secondary }]}>
                  <Ionicons name="checkmark-circle-outline" size={19} color={c.primary} />
                </View>
                <View style={s.flex}>
                  <Text style={[s.date, { color: c.foreground }]}>{formatHistoryDate(sale.date)}</Text>
                  <Text style={[s.meta, { color: c.mutedForeground }]}>
                    {sale.paidAt ? `Dibayar ${sale.paidAt}` : 'Pembayaran diterima'}
                  </Text>
                </View>
              </View>
              <Text style={[s.amount, { color: c.foreground }]}>{formatRp(sale.amount)}</Text>
            </View>
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <View style={s.detailRow}>
              <Text style={[s.items, { color: c.mutedForeground }]}>
                 {sale.items.map((item) => {
                    const name = item.displayName ?? (isConsignmentKey(item.menu)
                     ? consignments.find((consignment) => consignment.id === consignmentIdFromKey(item.menu))?.name
                      : menus.find((menu) => menu.id === item.menu)?.name);
                   return `${name || 'Item dihapus'} ×${item.qty}`;
                 }).join(' · ')}
              </Text>
              <Badge tone={sale.method === 'QRIS' ? 'accent' : 'muted'}>{sale.method}</Badge>
            </View>
            {sale.tables?.length ? (
              <Text style={[s.table, { color: c.mutedForeground }]}>
                <Ionicons name="grid-outline" size={12} /> {sale.tables.map((table) => `M${table}`).join(' + ')}
              </Text>
            ) : null}
          </Surface>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  periods: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  period: { borderWidth: 1, borderRadius: 11, paddingVertical: 10, paddingHorizontal: 13 },
  periodText: { fontSize: 11, fontWeight: '800' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 23 },
  summaryIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  summaryValue: { fontSize: 21, fontWeight: '800', marginTop: 4 },
  card: { marginBottom: 9, padding: 13 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  dateWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  icon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  flex: { flex: 1 },
  date: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 11, marginTop: 3 },
  amount: { fontSize: 13, fontWeight: '800' },
  divider: { height: 1, marginVertical: 11 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  items: { flex: 1, fontSize: 11, lineHeight: 17 },
  table: { fontSize: 11, marginTop: 9 },
});