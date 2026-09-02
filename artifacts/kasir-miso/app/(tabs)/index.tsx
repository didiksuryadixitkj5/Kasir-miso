import React, { useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { themeOptions } from '@/constants/colors';
import { consignmentKey, formatRp, getOrderItems, orderTotal, useWarung } from '@/context/WarungContext';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/context/ThemeContext';
import { useRouter } from 'expo-router';
import { Badge, EmptyState, IconButton, PageHeader, PrimaryButton, Screen, SectionHeader, Surface, ui } from '@/components/WarungUI';
import { persistImageAsset } from '@/utils/persistentImage';

export default function CashierScreen() {
  const c = useColors();
  const router = useRouter();
  const { mode, themeId, selectTheme, toggleMode } = useTheme();
  const { menus, consignments, activeOrders, updateOrderTables, payOrder, cancelOrder, mergeOrders, qrisImageUri, setQrisImageUri } = useWarung();
  const [tables, setTables] = useState<number[]>([]);
  const [paying, setPaying] = useState<string | null>(null);
  const [cash, setCash] = useState('');
  const [cashMode, setCashMode] = useState<'exact' | 'custom'>('exact');
  const [cashCounts, setCashCounts] = useState<Record<number, number>>({});
  const [qr, setQr] = useState(false);
  const [mergingOrderId, setMergingOrderId] = useState<string | null>(null);
  const [themePickerVisible, setThemePickerVisible] = useState(false);
  const [assigningTableTo, setAssigningTableTo] = useState<string | null>(null);
  const active = activeOrders.find((order) => order.id === paying);
  const catalogItems = [
    ...menus.map((menu) => ({ ...menu, category: menu.category || 'Lainnya' })),
    ...consignments.map((item) => ({ id: consignmentKey(item.id), name: item.name, price: item.sellPrice, recipe: {}, category: 'Titipan', imageUri: item.imageUri, isConsignment: true })),
  ];
  const cashDenominations = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  const selectedCash = useMemo(
    () => Object.entries(cashCounts).reduce((sum, [value, count]) => sum + Number(value) * count, 0),
    [cashCounts],
  );
  const receivedCash = cashMode === 'exact' ? (active ? orderTotal(active, menus, consignments) : 0) : selectedCash;
  const setCashPayment = (mode: 'exact' | 'custom') => {
    setCashMode(mode);
    if (mode === 'exact') {
      setCash('');
      setCashCounts({});
    }
  };
  const changeDenomination = (value: number, delta: number) => {
    haptic();
    setCashCounts((current) => ({ ...current, [value]: Math.max(0, (current[value] ?? 0) + delta) }));
  };

  const haptic = () => { Haptics.selectionAsync().catch(() => undefined); };
  const toggleTable = (number: number) => { haptic(); setTables((current) => current.includes(number) ? current.filter((item) => item !== number) : [...current, number]); };
  const confirmCancel = (id: string, tablesForOrder: number[]) => Alert.alert(
    'Batalkan pesanan?',
    `Pesanan ${tablesForOrder.map((table) => `M${table}`).join(' + ')} akan dihapus dan stoknya dikembalikan.`,
    [{ text: 'Tidak', style: 'cancel' }, { text: 'Ya, batalkan', style: 'destructive', onPress: () => cancelOrder(id) }],
  );
  const chooseMergeOrder = (order: typeof activeOrders[number]) => {
    if (!mergingOrderId) {
      haptic();
      setMergingOrderId(order.id);
      return;
    }
    if (mergingOrderId === order.id) {
      setMergingOrderId(null);
      return;
    }
    haptic();
    mergeOrders(mergingOrderId, order.id);
    setMergingOrderId(null);
  };
  const uploadQris = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1, base64: true });
      if (!result.canceled && result.assets[0]?.uri) {
        setQrisImageUri(await persistImageAsset(result.assets[0]));
        Alert.alert('QRIS tersimpan', 'Gambar QRIS akan tampil setiap kali pembayaran QRIS dibuka.');
      }
    } catch {
      Alert.alert('QRIS tidak tersedia', 'Gambar QRIS tidak bisa dibuka. Coba pilih gambar lain.');
    }
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Warung hari ini"
        title="Kasir & meja"
        subtitle="Catat cepat, kirim jelas, lanjut layani."
        action={<View style={s.headerActions}><IconButton icon="color-palette-outline" label="Pilih tema warna" onPress={() => setThemePickerVisible(true)} /><IconButton icon={mode === 'light' ? 'moon-outline' : 'sunny-outline'} label={mode === 'light' ? 'Gunakan mode gelap' : 'Gunakan mode terang'} onPress={toggleMode} /></View>}
      />
      <Modal visible={themePickerVisible} transparent animationType="fade" onRequestClose={() => setThemePickerVisible(false)}>
        <View style={[s.themeBackdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <View style={[s.themeModal, { backgroundColor: c.card }]}>
            <View style={s.modalTitleRow}>
              <View>
                <Text style={[s.modalKicker, { color: c.primary }]}>TAMPILAN APLIKASI</Text>
                <Text style={[s.modalTitle, { color: c.foreground }]}>Pilih tema warna</Text>
              </View>
              <Pressable accessibilityLabel="Tutup pilihan tema" onPress={() => setThemePickerVisible(false)}>
                <Ionicons name="close-circle" size={27} color={c.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView
              style={s.themeScroll}
              contentContainerStyle={s.themeScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {themeOptions.map((option) => {
                const selected = option.id === themeId;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      selectTheme(option.id);
                      haptic();
                    }}
                    style={({ pressed }) => [
                      s.themeOption,
                      {
                        backgroundColor: selected ? c.secondary : c.card,
                        borderColor: selected ? c.primary : c.border,
                        opacity: pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <View style={[s.themeSwatch, { backgroundColor: option.swatch }]}>
                      {selected ? <Ionicons name="checkmark" size={20} color={c.primaryForeground} /> : null}
                    </View>
                    <View style={s.themeCopy}>
                      <Text style={[s.themeLabel, { color: c.foreground }]}>{option.label}</Text>
                      <Text style={[s.themeDescription, { color: c.mutedForeground }]}>{option.description}</Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={21} color={c.primary} /> : null}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={toggleMode}
                style={({ pressed }) => [
                  s.modeButton,
                  { borderColor: c.border, backgroundColor: c.secondary, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Ionicons name={mode === 'light' ? 'moon-outline' : 'sunny-outline'} size={19} color={c.primary} />
                <Text style={[s.modeButtonText, { color: c.foreground }]}>
                  {mode === 'light' ? 'Gunakan mode gelap' : 'Gunakan mode terang'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Surface tone="ink" style={s.hero}>
        <View><Text style={[s.heroLabel, { color: c.mutedForeground }]}>MEJA AKTIF</Text><Text style={[s.heroNumber, { color: c.card }]}>{activeOrders.length}</Text><Text style={[s.heroCaption, { color: c.mutedForeground }]}>nota belum dibayar</Text></View>
        <View style={[s.heroIcon, { backgroundColor: c.accent }]}><Ionicons name="restaurant-outline" size={27} color={c.accentForeground} /></View>
      </Surface>

       <SectionHeader title="Akses cepat" meta="Alternatif" icon="flash-outline" />
       <View style={s.quickActions}>
         {[
           { label: 'Stok', icon: 'cube-outline' as const, route: '/inventory' as const },
           { label: 'Biaya', icon: 'wallet-outline' as const, route: '/expenses' as const },
           { label: 'Laporan', icon: 'bar-chart-outline' as const, route: '/reports' as const },
           { label: 'Riwayat', icon: 'time-outline' as const, route: '/history' as const },
         ].map((action) => (
           <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={`Buka ${action.label}`} onPress={() => router.push(action.route)} style={({ pressed }) => [s.quickAction, { backgroundColor: c.card, borderColor: c.border, opacity: pressed ? 0.7 : 1 }]}>
             <View style={[s.quickActionIcon, { backgroundColor: c.secondary }]}><Ionicons name={action.icon} size={18} color={c.primary} /></View>
             <Text style={[s.quickActionLabel, { color: c.foreground }]}>{action.label}</Text>
           </Pressable>
         ))}
       </View>

       <SectionHeader title="Antrean meja aktif" meta={`${activeOrders.length} meja`} icon="receipt-outline" />
        {mergingOrderId ? <Pressable onPress={() => setMergingOrderId(null)} style={[s.mergeNotice, { backgroundColor: c.secondary }]}><Ionicons name="git-merge-outline" size={17} color={c.primary} /><Text style={[s.mergeNoticeText, { color: c.foreground }]}>Pilih pesanan meja lain untuk digabung. Tekan di sini untuk batal.</Text></Pressable> : null}
        {activeOrders.map((order) => {
          const orderItems = getOrderItems(order);
          return <Surface key={order.id} style={s.orderCard}>
         <View style={s.orderHeader}><Badge tone={order.tables.length ? 'accent' : 'muted'}>{order.tables.length ? order.tables.map((table) => `M${table}`).join(' + ') : 'Tanpa meja'}</Badge><Text style={[s.time, { color: c.mutedForeground }]}>{order.createdAt}</Text></View>
           <Text style={[s.orderPax, { color: c.foreground }]}>{order.pax} pelanggan <Text style={{ color: c.mutedForeground, fontWeight: '500' }}>· {orderItems.reduce((sum, item) => sum + item.qty, 0)} item</Text></Text>
         <Text style={[s.cookedStatus, { color: order.cooked ? c.primary : c.mutedForeground }]}><Ionicons name={order.cooked ? 'checkmark-circle' : 'time-outline'} size={13} />  {order.cooked ? 'Sudah dimasak — siap dibayar' : 'Menunggu pesanan selesai dimasak'}</Text>
         <View style={s.orderDetails}>
           <View style={s.detailHeader}><Text style={[s.detailMenu, s.detailHeaderText, { color: c.mutedForeground }]}>MENU</Text><Text style={[s.detailUnit, s.detailHeaderText, { color: c.mutedForeground }]}>HARGA</Text><Text style={[s.detailSubtotal, s.detailHeaderText, { color: c.mutedForeground }]}>TOTAL</Text></View>
             {orderItems.map((item, index) => { const catalogItem = catalogItems.find((entry) => entry.id === item.menu); const unitPrice = catalogItem?.price ?? 0; return <View key={`${item.menu}-${index}`} style={s.detailRow}><Text style={[s.detailMenu, { color: c.foreground }]}>{item.qty}× {catalogItem?.name || 'Item dihapus'}</Text><Text style={[s.detailUnit, { color: c.mutedForeground }]}>{formatRp(unitPrice)}</Text><Text style={[s.detailSubtotal, { color: c.foreground }]}>{formatRp(unitPrice * item.qty)}</Text></View>; })}
         </View>
        {order.note ? <Text style={[s.note, { color: c.primary }]}><Ionicons name="chatbubble-ellipses-outline" size={13} />  {order.note}</Text> : null}
         <View style={s.orderActions}><Pressable onPress={() => { setTables(order.tables); setAssigningTableTo(order.id); }} style={({ pressed }) => [s.outlineButton, { borderColor: c.border, opacity: pressed ? 0.65 : 1 }]}><Ionicons name="grid-outline" size={16} color={c.primary} /><Text style={[s.outlineText, { color: c.primary }]}>{order.tables.length ? 'Ganti meja' : 'Pasangkan meja'}</Text></Pressable><Pressable onPress={() => chooseMergeOrder(order)} style={({ pressed }) => [s.mergeButton, { borderColor: c.primary, backgroundColor: mergingOrderId === order.id ? c.primary : c.card, opacity: pressed ? 0.65 : 1 }]}><Ionicons name="git-merge-outline" size={16} color={mergingOrderId === order.id ? c.primaryForeground : c.primary} /><Text style={[s.outlineText, { color: mergingOrderId === order.id ? c.primaryForeground : c.primary }]}>{mergingOrderId === order.id ? 'Meja utama' : mergingOrderId ? 'Gabungkan ke meja utama' : 'Gabung meja'}</Text></Pressable><Pressable disabled={!order.cooked} onPress={() => { setPaying(order.id); setCash(''); setCashMode('exact'); setCashCounts({}); }} style={({ pressed }) => [s.payButton, { backgroundColor: order.cooked ? c.foreground : c.muted, opacity: order.cooked ? (pressed ? 0.75 : 1) : 0.65 }]}><Text style={[s.payText, { color: order.cooked ? c.card : c.mutedForeground }]}>{order.cooked ? `Bayar ${formatRp(orderTotal(order, menus, consignments))}` : 'Belum matang'}</Text></Pressable><Pressable disabled={order.cooked} accessibilityLabel={`Batalkan pesanan ${order.tables.length ? order.tables.map((table) => `M${table}`).join(' dan ') : 'tanpa meja'}`} onPress={() => confirmCancel(order.id, order.tables)} style={({ pressed }) => [s.cancelButton, { borderColor: order.cooked ? c.border : c.destructive, opacity: order.cooked ? 0.45 : (pressed ? 0.65 : 1) }]}><Ionicons name="close-circle-outline" size={16} color={order.cooked ? c.mutedForeground : c.destructive} /><Text style={[s.outlineText, { color: order.cooked ? c.mutedForeground : c.destructive }]}>{order.cooked ? 'Tidak bisa dibatal' : 'Batalkan pesanan'}</Text></Pressable></View>
        </Surface>;
        })}
      {!activeOrders.length ? <EmptyState icon="checkmark-circle-outline" title="Semua meja sudah lunas" body="Siap menerima pesanan baru." /> : null}

         <Modal visible={!!paying} transparent animationType="slide" onRequestClose={() => setPaying(null)}>
        <View style={[s.modalBackdrop, { backgroundColor: c.foreground + 'B8' }]}><View style={[s.modal, { backgroundColor: c.card }]}>
          <View style={s.modalTitleRow}><View><Text style={[s.modalKicker, { color: c.primary }]}>SELESAIKAN NOTA</Text><Text style={[s.modalTitle, { color: c.foreground }]}>Pembayaran</Text></View><Pressable accessibilityLabel="Tutup pembayaran" onPress={() => setPaying(null)}><Ionicons name="close-circle" size={27} color={c.mutedForeground} /></Pressable></View>
           <Text style={[s.muted, { color: c.mutedForeground }]}>Total tagihan</Text><Text style={[s.modalTotal, { color: c.primary }]}>{active ? formatRp(orderTotal(active, menus, consignments)) : ''}</Text>
             {active ? <View style={[s.paymentDetails, { borderTopColor: c.border, borderBottomColor: c.border }]}><View style={s.detailHeader}><Text style={[s.detailMenu, s.detailHeaderText, { color: c.mutedForeground }]}>ITEM</Text><Text style={[s.detailUnit, s.detailHeaderText, { color: c.mutedForeground }]}>HARGA</Text><Text style={[s.detailSubtotal, s.detailHeaderText, { color: c.mutedForeground }]}>TOTAL</Text></View>{getOrderItems(active).map((item, index) => { const catalogItem = catalogItems.find((entry) => entry.id === item.menu); const unitPrice = catalogItem?.price ?? 0; return <View key={`${item.menu}-${index}`} style={s.detailRow}><Text style={[s.detailMenu, { color: c.foreground }]}>{item.qty}× {catalogItem?.name || 'Item dihapus'}</Text><Text style={[s.detailUnit, { color: c.mutedForeground }]}>{formatRp(unitPrice)}</Text><Text style={[s.detailSubtotal, { color: c.foreground }]}>{formatRp(unitPrice * item.qty)}</Text></View>; })}</View> : null}
           <Pressable onPress={() => setQr(true)} style={({ pressed }) => [s.payMethod, { backgroundColor: c.foreground, opacity: pressed ? 0.78 : 1 }]}><Ionicons name="qr-code-outline" size={22} color={c.accent} /><View><Text style={[s.methodTitle, { color: c.card }]}>Bayar QRIS</Text><Text style={[s.methodSub, { color: c.mutedForeground }]}>Nominal pas, tampilkan QRIS warung</Text></View><Ionicons name="chevron-forward" size={18} color={c.accent} /></Pressable>
           <Text style={[s.label, { color: c.mutedForeground }]}>Cara bayar tunai</Text>
           <View style={s.cashModeRow}>
             <Pressable onPress={() => setCashPayment('exact')} style={[s.cashModeButton, { backgroundColor: cashMode === 'exact' ? c.primary : c.secondary }]}><Text style={[s.cashModeText, { color: cashMode === 'exact' ? c.primaryForeground : c.secondaryForeground }]}>Uang pas</Text></Pressable>
             <Pressable onPress={() => setCashPayment('custom')} style={[s.cashModeButton, { backgroundColor: cashMode === 'custom' ? c.primary : c.secondary }]}><Text style={[s.cashModeText, { color: cashMode === 'custom' ? c.primaryForeground : c.secondaryForeground }]}>Pilih pecahan</Text></Pressable>
           </View>
           {cashMode === 'custom' ? <View style={s.denominations}>
             {cashDenominations.map((value) => <View key={value} style={[s.denominationRow, { borderBottomColor: c.border }]}>
               <Text style={[s.denominationLabel, { color: c.foreground }]}>{formatRp(value)}</Text>
               <View style={s.denominationControls}>
                 <Pressable accessibilityLabel={`Kurangi pecahan ${formatRp(value)}`} onPress={() => changeDenomination(value, -1)} style={[s.denominationButton, { backgroundColor: c.secondary }]}><Ionicons name="remove" size={16} color={c.secondaryForeground} /></Pressable>
                 <Text style={[s.denominationCount, { color: c.foreground }]}>{cashCounts[value] ?? 0}x</Text>
                 <Pressable accessibilityLabel={`Tambah pecahan ${formatRp(value)}`} onPress={() => changeDenomination(value, 1)} style={[s.denominationButton, { backgroundColor: c.primary }]}><Ionicons name="add" size={16} color={c.primaryForeground} /></Pressable>
               </View>
             </View>)}
           </View> : <Text style={[s.exactHint, { color: c.mutedForeground }]}>Pelanggan membayar tepat sesuai total tagihan.</Text>}
            <View style={[s.cashSummary, { backgroundColor: c.secondary }]}>
              <View><Text style={[s.summaryLabel, { color: c.mutedForeground }]}>UANG DITERIMA</Text><Text style={[s.summaryValue, { color: c.foreground }]}>{formatRp(receivedCash)}</Text></View>
              <View style={s.summaryRight}><Text style={[s.summaryLabel, { color: c.mutedForeground }]}>KEMBALIAN</Text><Text style={[s.summaryValue, { color: receivedCash >= (active ? orderTotal(active, menus, consignments) : 0) ? c.primary : c.destructive }]}>{formatRp(Math.max(0, receivedCash - (active ? orderTotal(active, menus, consignments) : 0)))}</Text></View>
           </View>
            <PrimaryButton disabled={!active || receivedCash < orderTotal(active, menus, consignments)} onPress={() => { if (active) payOrder(active.id, orderTotal(active, menus, consignments), 'Tunai'); setPaying(null); }} icon="checkmark-circle-outline">Konfirmasi tunai</PrimaryButton>
        </View></View>
      </Modal>
       <Modal visible={!!assigningTableTo} transparent animationType="fade" onRequestClose={() => setAssigningTableTo(null)}>
         <View style={[s.modalBackdrop, { backgroundColor: c.foreground + 'B8', justifyContent: 'center', padding: 20 }]}>
           <View style={[s.tableModal, { backgroundColor: c.card }]}>
             <View style={s.modalTitleRow}><View><Text style={[s.modalKicker, { color: c.primary }]}>PESANAN SUDAH MASUK</Text><Text style={[s.modalTitle, { color: c.foreground }]}>Pasangkan meja</Text></View><Pressable accessibilityLabel="Tutup pilihan meja" onPress={() => setAssigningTableTo(null)}><Ionicons name="close-circle" size={27} color={c.mutedForeground} /></Pressable></View>
             <Text style={[s.muted, { color: c.mutedForeground }]}>Pilih satu atau beberapa meja untuk pesanan ini.</Text>
             <View style={s.tableGrid}>{Array.from({ length: 10 }, (_, index) => index + 1).map((number) => <Pressable key={number} onPress={() => toggleTable(number)} style={({ pressed }) => [s.tableChip, { borderColor: c.border, backgroundColor: tables.includes(number) ? c.primary : c.secondary, opacity: pressed ? 0.7 : 1 }]}><Text style={[s.tableText, { color: tables.includes(number) ? c.primaryForeground : c.secondaryForeground }]}>M{number}</Text></Pressable>)}</View>
             <View style={s.tableModalActions}><Pressable onPress={() => { setTables([]); updateOrderTables(assigningTableTo!, []); setAssigningTableTo(null); }} style={({ pressed }) => [s.clearTableButton, { borderColor: c.border, opacity: pressed ? 0.65 : 1 }]}><Text style={[s.outlineText, { color: c.mutedForeground }]}>Kosongkan</Text></Pressable><PrimaryButton disabled={!tables.length} onPress={() => { updateOrderTables(assigningTableTo!, tables); setAssigningTableTo(null); }} icon="checkmark-circle-outline">Simpan meja</PrimaryButton></View>
           </View>
         </View>
       </Modal>
       <Modal visible={qr} transparent animationType="fade" onRequestClose={() => setQr(false)}>
         <View style={[s.modalBackdrop, { backgroundColor: c.foreground + 'B8', justifyContent: 'center' }]}><View style={[s.qrModal, { backgroundColor: c.card }]}><Pressable accessibilityLabel="Kembali ke pembayaran tunai" onPress={() => setQr(false)} style={({ pressed }) => [s.backToCash, { opacity: pressed ? 0.65 : 1 }]}><Ionicons name="arrow-back" size={17} color={c.primary} /><Text style={[s.outlineText, { color: c.primary }]}>Kembali ke tunai</Text></Pressable><Text style={[s.modalKicker, { color: c.primary }]}>PEMBAYARAN DIGITAL</Text><Text style={[s.modalTitle, { color: c.foreground }]}>QRIS Warung</Text><Text style={[s.muted, { color: c.mutedForeground }]}>Scan untuk membayar {active ? formatRp(orderTotal(active, menus, consignments)) : ''}</Text>{qrisImageUri ? <Image source={{ uri: qrisImageUri }} resizeMode="contain" style={s.qrisImage} /> : <View style={[s.qrBox, { backgroundColor: c.card, borderColor: c.border }]}>{Array.from({ length: 49 }, (_, index) => <View key={index} style={[s.qrPixel, { backgroundColor: ((index * 7 + index * index) % 11 < 5) ? c.foreground : c.card }]} />)}</View>}<Pressable onPress={uploadQris} style={({ pressed }) => [s.uploadButton, { borderColor: c.primary, opacity: pressed ? 0.65 : 1 }]}><Ionicons name="cloud-upload-outline" size={17} color={c.primary} /><Text style={[s.outlineText, { color: c.primary }]}>{qrisImageUri ? 'Ganti gambar QRIS' : 'Upload gambar QRIS'}</Text></Pressable><PrimaryButton onPress={() => { if (active) payOrder(active.id, orderTotal(active, menus, consignments), 'QRIS'); setQr(false); setPaying(null); }} icon="checkmark-circle-outline">Pembayaran diterima</PrimaryButton></View></View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hero: { minHeight: 125, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 21 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  heroNumber: { fontSize: 42, fontWeight: '700', letterSpacing: -1, marginTop: 2 },
  heroCaption: { fontSize: 12 },
  heroIcon: { width: 57, height: 57, borderRadius: 19, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 19 },
  quickAction: { width: '48.5%', minHeight: 58, borderWidth: 1, borderRadius: 15, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  quickActionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 12, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 7, marginTop: 7 },
  tableGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tableChip: { width: 43, height: 38, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tableText: { fontSize: 12, fontWeight: '800' },
  tableHint: { fontSize: 11, marginTop: 9 },
  tablePickerButton: { minHeight: 62, borderWidth: 1, borderRadius: 15, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  tablePickerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tablePickerTitle: { fontSize: 13, fontWeight: '800' },
  tablePickerSub: { fontSize: 11, marginTop: 3 },
  joined: { fontSize: 12, fontWeight: '700', marginTop: 10 },
  formRow: { flexDirection: 'row', gap: 9, marginTop: 3 },
  flex: { flex: 1 },
  input: { height: 45, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, fontSize: 13 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  categoryRow: { gap: 8, paddingBottom: 12 },
  categoryChip: { borderWidth: 1, borderRadius: 18, paddingVertical: 9, paddingHorizontal: 15 },
  categoryChipText: { fontSize: 12, fontWeight: '800' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  menuCard: { width: '48.5%', minHeight: 240, borderWidth: 1, borderRadius: 18, padding: 11, alignItems: 'center' },
  menuCardIcon: { width: 86, height: 86, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  menuImage: { width: '100%', height: '100%', borderRadius: 18 },
  menuCardName: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  menuCardPrice: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  itemType: { fontSize: 10, marginTop: 3 },
  stockPill: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, marginTop: 6 },
  stockPillText: { fontSize: 10, fontWeight: '800' },
  addModeBanner: { borderWidth: 1, borderRadius: 15, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14 },
  addModeIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  addModeCopy: { flex: 1 },
  addModeTitle: { fontSize: 12, fontWeight: '800' },
  addModeSub: { fontSize: 10, marginTop: 3 },
  cancelAddButton: { minHeight: 34, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  cancelAddText: { fontSize: 11, fontWeight: '800' },
  cardQtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9, gap: 7 },
  menuIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  menuName: { fontSize: 13, fontWeight: '700' },
  price: { fontSize: 11, marginTop: 2 },
  qty: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { width: 25, textAlign: 'center', fontWeight: '800' },
  emptyHint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  submitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 10, paddingTop: 14, gap: 8 },
  totalCaption: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  total: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  orderCard: { marginBottom: 10 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontSize: 11 },
  orderPax: { fontSize: 14, fontWeight: '800', marginTop: 12 },
  orderDetails: { marginTop: 8, gap: 4 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  detailHeaderText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  detailRow: { flexDirection: 'row', alignItems: 'center', minHeight: 24 },
  detailMenu: { flex: 1, fontSize: 12, fontWeight: '600' },
  detailUnit: { width: 76, textAlign: 'right', fontSize: 11 },
  detailSubtotal: { width: 86, textAlign: 'right', fontSize: 11, fontWeight: '700' },
  cookedStatus: { fontSize: 11, fontWeight: '700', marginTop: 8 },
  note: { fontSize: 12, marginTop: 8, fontWeight: '700' },
  orderActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  outlineButton: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  mergeButton: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  mergeNotice: { borderRadius: 13, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mergeNoticeText: { flex: 1, fontSize: 12, fontWeight: '700' },
  outlineText: { fontSize: 11, fontWeight: '800' },
  payButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  payText: { fontSize: 11, fontWeight: '800' },
  cancelButton: { width: '100%', borderWidth: 1, borderRadius: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 34 },
  tableModal: { borderRadius: 25, padding: 20 },
  tableModalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 9, marginTop: 20 },
  tablePickerModal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 32 },
  tableCountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13, marginTop: 16 },
  tableCountButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tableCountText: { minWidth: 105, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  addTableButton: { minHeight: 46, borderWidth: 1, borderRadius: 14, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16 },
  tablePickerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 9, marginTop: 11 },
  clearTableButton: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  themeBackdrop: { flex: 1, justifyContent: 'center', padding: 20 },
  themeModal: { width: '100%', maxHeight: '84%', borderRadius: 26, padding: 18 },
  themeScroll: { flexShrink: 1 },
  themeScrollContent: { paddingBottom: 2 },
  themeOption: { minHeight: 62, borderWidth: 1, borderRadius: 15, padding: 10, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  themeSwatch: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  themeCopy: { flex: 1 },
  themeLabel: { fontSize: 14, fontWeight: '800' },
  themeDescription: { fontSize: 11, marginTop: 2 },
  modeButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, marginTop: 13, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  modeButtonText: { fontSize: 13, fontWeight: '800' },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginTop: 3 },
  muted: { fontSize: 12 },
  modalTotal: { fontSize: 32, fontWeight: '700', marginTop: 4, marginBottom: 18 },
  paymentDetails: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 9, marginBottom: 14, gap: 6 },
  payMethod: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 15, marginBottom: 14 },
  methodTitle: { fontWeight: '700', fontSize: 14 },
  methodSub: { fontSize: 11, marginTop: 3 },
  cashModeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  cashModeButton: { flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cashModeText: { fontSize: 12, fontWeight: '800' },
  exactHint: { fontSize: 12, marginBottom: 10 },
  denominations: { marginBottom: 10, flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
  denominationRow: { width: '47%', minHeight: 38, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  denominationLabel: { fontSize: 13, fontWeight: '700' },
  denominationControls: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  denominationButton: { width: 27, height: 27, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  denominationCount: { width: 29, textAlign: 'center', fontSize: 11, fontWeight: '800' },
  cashSummary: { borderRadius: 13, padding: 12, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between' },
  summaryRight: { alignItems: 'flex-end' },
  summaryLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  summaryValue: { fontSize: 17, fontWeight: '800', marginTop: 3 },
  qrModal: { borderRadius: 26, padding: 24, margin: 25, alignItems: 'center' },
  qrBox: { width: 210, height: 210, padding: 15, marginVertical: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 2, borderWidth: 1 },
  qrisImage: { width: 210, height: 210, marginVertical: 20, borderRadius: 12 },
  backToCash: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  uploadButton: { width: '100%', borderWidth: 1, borderRadius: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 },
  qrPixel: { width: 24, height: 24 },
});