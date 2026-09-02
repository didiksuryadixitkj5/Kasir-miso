import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActiveOrder, useWarung } from '@/context/WarungContext';
import { useColors } from '@/hooks/useColors';
import { Badge, EmptyState, PageHeader, Screen, SectionHeader, Surface } from '@/components/WarungUI';
import { OrderComposer } from '@/components/OrderComposer';

export default function KitchenScreen() {
  const c = useColors();
  const { menus, consignments, kitchenOrders, activeOrders, inventory, completeKitchen } = useWarung();
  const [addingTo, setAddingTo] = useState<ActiveOrder | null>(null);
  const lowStockCount = inventory.filter((item) => item.qty <= item.safe).length;
  const itemName = (item: ActiveOrder['items'][number]) =>
    item.displayName
    ?? menus.find((menu) => menu.id === item.menu)?.name
    ?? consignments.find((consignment) => `consignment:${consignment.id}` === item.menu)?.name
    ?? 'Menu dihapus';
  return (
    <Screen>
      <PageHeader eyebrow="Operasional" title="Dapur & pesanan" subtitle="Catat pesanan, lalu masak dari antrean yang sama." />
      <OrderComposer
        key={addingTo?.id ?? 'new-order'}
        targetOrder={addingTo}
        onComplete={() => setAddingTo(null)}
        onCancel={() => setAddingTo(null)}
      />
      <Surface tone="ink" style={s.banner}><View style={[s.bannerIcon, { backgroundColor: c.accent }]}><Ionicons name="flame-outline" size={20} color={c.accentForeground} /></View><View style={s.flex}><Text style={[s.bannerNumber, { color: c.card }]}>{kitchenOrders.length}</Text><Text style={[s.bannerText, { color: c.mutedForeground }]}>pesanan menunggu dimasak</Text></View><Ionicons name="chevron-forward" size={18} color={c.primary} /></Surface>
      {lowStockCount ? <Surface style={[s.warning, { backgroundColor: c.muted }]}><Ionicons name="warning-outline" size={18} color={c.destructive} /><Text style={[s.warningText, { color: c.foreground }]}>{lowStockCount} bahan perlu diisi ulang agar pesanan berikutnya tetap lancar.</Text></Surface> : null}
      <SectionHeader title="Pesanan masuk" meta="paling baru di bawah" icon="time-outline" />
        {kitchenOrders.map((order) => {
          const parentOrder = activeOrders.find((activeOrder) => activeOrder.id === (order.parentOrderId ?? order.id));
          return <Surface key={order.id} style={s.card}>
         <View style={s.row}><Badge tone={order.tables.length ? 'accent' : 'muted'}>{order.tables.length ? order.tables.map((table) => `M${table}`).join(' + ') : 'Tanpa meja'}</Badge><Text style={[s.time, { color: c.mutedForeground }]}>{order.createdAt}</Text></View>
         {!order.isAdditional ? <Text style={[s.pax, { color: c.foreground }]}>{order.pax} PELANGGAN</Text> : <Text style={[s.additionalLabel, { color: c.primary }]}>TAMBAHAN PESANAN</Text>}
         {order.items.map((item, index) => <View key={`${item.menu}-${index}`} style={s.item}><Text style={[s.qty, { color: c.primary }]}>{item.qty}×</Text><Text style={[s.itemName, { color: c.foreground }]}>{itemName(item)}</Text></View>)}
        {order.note ? <Text style={[s.note, { color: c.primary }]}><Ionicons name="chatbubble-outline" size={13} />  {order.note}</Text> : null}
         <View style={s.cardActions}>
           {parentOrder ? <Pressable onPress={() => setAddingTo(parentOrder)} style={({ pressed }) => [s.addButton, { borderColor: c.border, opacity: pressed ? 0.68 : 1 }]}><Ionicons name="add" size={17} color={c.primary} /><Text style={[s.addText, { color: c.primary }]}>Tambah menu</Text></Pressable> : null}
           <Pressable testID={`done-${order.id}`} onPress={() => completeKitchen(order.id)} style={({ pressed }) => [s.done, { backgroundColor: c.primary, opacity: pressed ? 0.72 : 1 }]}><Ionicons name="checkmark" size={17} color={c.primaryForeground} /><Text style={[s.doneText, { color: c.primaryForeground }]}>Selesai dimasak</Text></Pressable>
         </View>
       </Surface>;
        })}
      {!kitchenOrders.length ? <EmptyState icon="restaurant-outline" title="Dapur sudah kosong" body="Pesanan baru akan muncul di sini." /> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  banner: { borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 22 },
  bannerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bannerNumber: { fontSize: 20, fontWeight: '800' },
  bannerText: { fontSize: 12, marginTop: 1 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, marginBottom: 18, borderRadius: 15 },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  flex: { flex: 1 },
  card: { marginBottom: 11 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontSize: 12 },
  pax: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 15, marginBottom: 8 },
  additionalLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 15, marginBottom: 8 },
  item: { flexDirection: 'row', paddingVertical: 5 },
  qty: { width: 32, fontWeight: '800' },
  itemName: { fontSize: 14, fontWeight: '600' },
  note: { fontSize: 12, fontWeight: '600', marginTop: 10 },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 15 },
  addButton: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  addText: { fontWeight: '800', fontSize: 11 },
  done: { flex: 1.35, borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  doneText: { fontWeight: '800', fontSize: 12 },
});