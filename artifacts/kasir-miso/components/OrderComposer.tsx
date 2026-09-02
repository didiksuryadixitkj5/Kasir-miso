import React, { useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  ActiveOrder,
  consignmentIdFromKey,
  consignmentKey,
  formatRp,
  isConsignmentKey,
  MenuKey,
  OrderItem,
  useWarung,
} from '@/context/WarungContext';
import { PrimaryButton, SectionHeader, Surface } from '@/components/WarungUI';

const standardMenuImage = require('../assets/images/icon.png');
type CatalogItem = { id: string; name: string; price: number; category: string; imageUri?: string; isConsignment?: boolean };

interface OrderComposerProps {
  targetOrder?: ActiveOrder | null;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function OrderComposer({ targetOrder = null, onComplete, onCancel }: OrderComposerProps) {
  const c = useColors();
  const {
    menus,
    inventory,
    consignments,
    addOrder,
    addItems,
  } = useWarung();
  const [tables, setTables] = useState<number[]>(targetOrder?.tables ?? []);
  const [pax, setPax] = useState(String(targetOrder?.pax ?? 2));
  const [note, setNote] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [menuCategory, setMenuCategory] = useState('Semua');
  const [tablePickerVisible, setTablePickerVisible] = useState(false);
  const [availableTableCount, setAvailableTableCount] = useState(Math.max(3, targetOrder?.tables.length ?? 0));
  const isAdding = Boolean(targetOrder);

  const catalogItems: CatalogItem[] = [
    ...menus.map((menu) => ({ ...menu, category: menu.category || 'Lainnya' })),
    ...consignments.map((item) => ({
      id: consignmentKey(item.id),
      name: item.name,
      price: item.sellPrice,
      category: 'Titipan',
      imageUri: item.imageUri,
      isConsignment: true,
    })),
  ];
  const menuCategories = ['Semua', ...Array.from(new Set(catalogItems.map((menu) => menu.category)))];
  const visibleMenus = catalogItems.filter((menu) => menuCategory === 'Semua' || menu.category === menuCategory);
  const draftTotal = cart.reduce(
    (sum, item) => sum + (catalogItems.find((catalogItem) => catalogItem.id === item.menu)?.price ?? 0) * item.qty,
    0,
  );

  const getMenuAvailability = (menu: MenuKey) => {
    const otherCartItems = cart.filter((item) => item.menu !== menu);
    if (isConsignmentKey(menu)) {
      const reserved = otherCartItems.filter((item) => item.menu === menu).reduce((sum, item) => sum + item.qty, 0);
      return Math.max(0, (consignments.find((item) => item.id === consignmentIdFromKey(menu))?.qty ?? 0) - reserved);
    }
    const recipe = menus.find((item) => item.id === menu)?.recipe ?? {};
    const ingredients = Object.entries(recipe);
    if (!ingredients.length) return Number.POSITIVE_INFINITY;
    return Math.min(...ingredients.map(([id, required]) => {
      const reserved = otherCartItems.reduce((sum, cartItem) => {
        const cartRecipe = menus.find((item) => item.id === cartItem.menu)?.recipe ?? {};
        return sum + (cartRecipe[id] || 0) * cartItem.qty;
      }, 0);
      const available = Math.max(0, (inventory.find((item) => item.id === id)?.qty ?? 0) - reserved);
      return required > 0 ? Math.floor(available / required) : Number.POSITIVE_INFINITY;
    }));
  };

  const haptic = () => {
    Haptics.selectionAsync().catch(() => undefined);
  };

  const toggleTable = (number: number) => {
    haptic();
    setTables((current) => current.includes(number) ? current.filter((item) => item !== number) : [...current, number]);
  };

  const changeQty = (key: MenuKey, delta: number) => {
    haptic();
    const found = cart.find((item) => item.menu === key);
    if (delta > 0 && (found?.qty ?? 0) >= getMenuAvailability(key)) return;
    setCart((current) => {
      if (!found && delta > 0) return [...current, { menu: key, qty: 1 }];
      return current
        .map((item) => item.menu === key ? { ...item, qty: Math.max(0, item.qty + delta) } : item)
        .filter((item) => item.qty > 0);
    });
  };

  const resetComposer = () => {
    setCart([]);
    setNote('');
    if (!isAdding) setTables([]);
    haptic();
  };

  const cancelAdding = () => {
    resetComposer();
    onCancel?.();
  };

  const submit = () => {
    if (!cart.length) {
      Alert.alert('Pesanan belum lengkap', 'Pilih minimal satu menu.');
      return;
    }
    if (targetOrder) {
      addItems(targetOrder.id, cart, note);
    } else {
      addOrder(tables, Number(pax) || 1, cart, note);
    }
    setCart([]);
    setNote('');
    setTables([]);
    haptic();
    onComplete?.();
    Alert.alert(
      isAdding ? 'Tambahan masuk' : 'Masuk ke dapur',
      isAdding ? 'Tambahan pesanan sudah dikirim ke antrean dapur.' : 'Pesanan baru sudah berada di antrean dapur.',
    );
  };

  const changeAvailableTableCount = (delta: number) => {
    setAvailableTableCount((current) => {
      const next = Math.max(1, current + delta);
      if (next < current) setTables((selected) => selected.filter((table) => table <= next));
      return next;
    });
  };

  return (
    <>
      <Surface style={s.composer}>
        <View style={s.composerHeader}>
          <View style={s.composerTitleWrap}>
            <View style={[s.composerIcon, { backgroundColor: c.primary }]}>
              <Ionicons name={isAdding ? 'add-circle-outline' : 'create-outline'} size={19} color={c.primaryForeground} />
            </View>
            <View style={s.flex}>
              <Text style={[s.composerTitle, { color: c.foreground }]}>
                {isAdding ? `Tambah ke ${targetOrder?.tables.length ? targetOrder.tables.map((table) => `M${table}`).join(' + ') : 'pesanan ini'}` : 'Pesanan baru'}
              </Text>
              <Text style={[s.composerSub, { color: c.mutedForeground }]}>
                {isAdding ? 'Tambahkan menu tanpa membuat nota baru.' : 'Pilih meja, menu, lalu kirim ke dapur.'}
              </Text>
            </View>
          </View>
          {isAdding ? (
            <Pressable accessibilityLabel="Batal tambah pesanan" onPress={cancelAdding} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Ionicons name="close-circle" size={26} color={c.mutedForeground} />
            </Pressable>
          ) : null}
        </View>

        <View style={s.formRow}>
          <View style={s.flex}>
            <Text style={[s.label, { color: c.mutedForeground }]}>Meja</Text>
            <Pressable
              testID="order-table-picker"
              onPress={() => setTablePickerVisible(true)}
              style={({ pressed }) => [s.tableButton, { backgroundColor: c.secondary, borderColor: c.border, opacity: pressed ? 0.72 : 1 }]}
            >
              <Ionicons name="grid-outline" size={16} color={c.primary} />
              <Text numberOfLines={1} style={[s.tableButtonText, { color: c.foreground }]}>
                {tables.length ? tables.map((table) => `M${table}`).join(' + ') : 'Pilih meja'}
              </Text>
            </Pressable>
          </View>
          {!isAdding ? (
            <View style={s.paxField}>
              <Text style={[s.label, { color: c.mutedForeground }]}>Orang</Text>
              <TextInput
                testID="pax-input"
                value={pax}
                onChangeText={setPax}
                keyboardType="number-pad"
                style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]}
              />
            </View>
          ) : null}
          <View style={s.flex}>
            <Text style={[s.label, { color: c.mutedForeground }]}>Catatan</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Pedas, tanpa sawi..."
              placeholderTextColor={c.mutedForeground}
              style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]}
            />
          </View>
        </View>

        <SectionHeader title="Pilih menu" meta={cart.length ? `${cart.reduce((sum, item) => sum + item.qty, 0)} item` : 'ketuk + untuk tambah'} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.categoryRow}>
          {menuCategories.map((category) => (
            <Pressable
              key={category}
              onPress={() => setMenuCategory(category)}
              style={({ pressed }) => [
                s.categoryChip,
                {
                  backgroundColor: menuCategory === category ? c.primary : c.secondary,
                  borderColor: menuCategory === category ? c.primary : c.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[s.categoryChipText, { color: menuCategory === category ? c.primaryForeground : c.secondaryForeground }]}>{category}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={s.menuGrid}>
          {visibleMenus.map((item) => {
            const qty = cart.find((entry) => entry.menu === item.id)?.qty ?? 0;
            const available = getMenuAvailability(item.id);
            const unavailable = available <= qty;
            return (
              <View key={item.id} style={[s.menuCard, { borderColor: qty ? c.primary : c.border, backgroundColor: qty ? c.secondary : c.card }]}>
                <View style={s.menuCardTop}>
                  <View style={[s.menuCardIcon, { backgroundColor: c.secondary }]}>
                    {item.imageUri ? <Image source={{ uri: item.imageUri }} style={s.menuImage} /> : <Image source={standardMenuImage} style={s.menuImage} resizeMode="contain" />}
                  </View>
                  <View style={s.menuCopy}>
                    <Text numberOfLines={1} style={[s.menuCardName, { color: c.foreground }]}>{item.name}</Text>
                    <Text style={[s.menuCardPrice, { color: c.primary }]}>{formatRp(item.price)}</Text>
                    <Text style={[s.stockText, { color: unavailable ? c.destructive : c.mutedForeground }]}>
                      {unavailable ? 'Habis' : item.isConsignment ? `${available - qty} biji` : Number.isFinite(available) ? `${available - qty} porsi` : 'Tersedia'}
                    </Text>
                  </View>
                </View>
                <View style={s.cardQtyRow}>
                  <Pressable accessibilityLabel={`Kurangi ${item.name}`} onPress={() => changeQty(item.id, -1)} style={[s.qty, { backgroundColor: c.secondary }]}>
                    <Ionicons name="remove" size={16} color={c.secondaryForeground} />
                  </Pressable>
                  <Text style={[s.qtyValue, { color: c.foreground }]}>{qty}</Text>
                  <Pressable
                    testID={`add-menu-${item.id}`}
                    accessibilityLabel={`Tambah ${item.name}`}
                    disabled={unavailable}
                    onPress={() => changeQty(item.id, 1)}
                    style={({ pressed }) => [s.qty, { backgroundColor: unavailable ? c.muted : c.primary, opacity: unavailable ? 0.45 : pressed ? 0.7 : 1 }]}
                  >
                    <Ionicons name="add" size={17} color={unavailable ? c.mutedForeground : c.primaryForeground} />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {!catalogItems.length ? <Text style={[s.emptyHint, { color: c.mutedForeground }]}>Belum ada menu. Tambahkan menu terlebih dahulu di tab Stok.</Text> : null}
        <View style={[s.submitRow, { borderTopColor: c.border }]}>
          <View>
            <Text style={[s.totalCaption, { color: c.mutedForeground }]}>TOTAL SEMENTARA</Text>
            <Text style={[s.total, { color: c.foreground }]}>{formatRp(draftTotal)}</Text>
          </View>
          <PrimaryButton testID="send-order" disabled={!cart.length} onPress={submit} icon="paper-plane-outline">
            {isAdding ? 'Kirim tambahan' : 'Kirim ke dapur'}
          </PrimaryButton>
        </View>
        {cart.length ? (
          <Pressable testID="clear-order" onPress={resetComposer} style={({ pressed }) => [s.clearButton, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="refresh-outline" size={15} color={c.mutedForeground} />
            <Text style={[s.clearText, { color: c.mutedForeground }]}>Kosongkan pilihan</Text>
          </Pressable>
        ) : null}
      </Surface>

      <Modal visible={tablePickerVisible} transparent animationType="slide" onRequestClose={() => setTablePickerVisible(false)}>
        <View style={[s.modalBackdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <View style={[s.tableModal, { backgroundColor: c.card }]}>
            <View style={s.modalTitleRow}>
              <View>
                <Text style={[s.modalKicker, { color: c.primary }]}>PESANAN</Text>
                <Text style={[s.modalTitle, { color: c.foreground }]}>Pilih nomor meja</Text>
              </View>
              <Pressable accessibilityLabel="Tutup pilihan meja" onPress={() => setTablePickerVisible(false)}>
                <Ionicons name="close-circle" size={27} color={c.mutedForeground} />
              </Pressable>
            </View>
            <Text style={[s.muted, { color: c.mutedForeground }]}>Bisa pilih beberapa meja untuk satu pesanan.</Text>
            <View style={s.tableGrid}>
              {Array.from({ length: availableTableCount }, (_, index) => index + 1).map((number) => (
                <Pressable
                  key={number}
                  testID={`table-${number}`}
                  onPress={() => toggleTable(number)}
                  style={({ pressed }) => [s.tableChip, { borderColor: c.border, backgroundColor: tables.includes(number) ? c.primary : c.secondary, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[s.tableText, { color: tables.includes(number) ? c.primaryForeground : c.secondaryForeground }]}>M{number}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.tableCountRow}>
              <Pressable accessibilityLabel="Kurangi jumlah meja" disabled={availableTableCount <= 1} onPress={() => changeAvailableTableCount(-1)} style={[s.tableCountButton, { backgroundColor: availableTableCount <= 1 ? c.muted : c.secondary }]}>
                <Ionicons name="remove" size={19} color={availableTableCount <= 1 ? c.mutedForeground : c.secondaryForeground} />
              </Pressable>
              <Text style={[s.tableCountText, { color: c.foreground }]}>{availableTableCount} meja tampil</Text>
              <Pressable accessibilityLabel={`Tambah meja M${availableTableCount + 1}`} onPress={() => changeAvailableTableCount(1)} style={[s.tableCountButton, { backgroundColor: c.primary }]}>
                <Ionicons name="add" size={19} color={c.primaryForeground} />
              </Pressable>
            </View>
            <View style={s.tableActions}>
              <Pressable onPress={() => { setTables([]); setTablePickerVisible(false); }} style={[s.clearTableButton, { borderColor: c.border }]}>
                <Text style={[s.clearText, { color: c.mutedForeground }]}>Tanpa meja</Text>
              </Pressable>
              <PrimaryButton onPress={() => setTablePickerVisible(false)} icon="checkmark-circle-outline">Pakai meja</PrimaryButton>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  composer: { marginBottom: 20 },
  composerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  composerTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  composerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  composerTitle: { fontSize: 17, fontWeight: '800' },
  composerSub: { fontSize: 11, marginTop: 2 },
  flex: { flex: 1 },
  formRow: { flexDirection: 'row', gap: 8 },
  paxField: { width: 62 },
  label: { fontSize: 10, fontWeight: '800', marginBottom: 6 },
  tableButton: { height: 44, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tableButtonText: { flex: 1, fontSize: 12, fontWeight: '800' },
  input: { height: 44, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, fontSize: 12 },
  categoryRow: { gap: 7, paddingBottom: 10 },
  categoryChip: { borderWidth: 1, borderRadius: 17, paddingVertical: 8, paddingHorizontal: 13 },
  categoryChipText: { fontSize: 11, fontWeight: '800' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  menuCard: { width: '48.5%', borderWidth: 1, borderRadius: 15, padding: 9 },
  menuCardTop: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  menuCardIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  menuImage: { width: '100%', height: '100%', borderRadius: 12 },
  menuCopy: { flex: 1 },
  menuCardName: { fontSize: 12, fontWeight: '800' },
  menuCardPrice: { fontSize: 11, fontWeight: '800', marginTop: 3 },
  stockText: { fontSize: 9, marginTop: 2 },
  cardQtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 7, marginTop: 8 },
  qty: { width: 29, height: 29, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { width: 20, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  emptyHint: { fontSize: 12, lineHeight: 18, marginTop: 10 },
  submitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 13, paddingTop: 13, gap: 8 },
  totalCaption: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  total: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  clearButton: { alignSelf: 'flex-end', marginTop: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  clearText: { fontSize: 11, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  tableModal: { borderTopLeftRadius: 27, borderTopRightRadius: 27, padding: 21, paddingBottom: 31 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  modalTitle: { fontSize: 21, fontWeight: '800', marginTop: 3 },
  muted: { fontSize: 12 },
  tableGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 16 },
  tableChip: { width: 45, height: 40, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tableText: { fontSize: 12, fontWeight: '800' },
  tableCountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13, marginTop: 16 },
  tableCountButton: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  tableCountText: { minWidth: 105, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  tableActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 9, marginTop: 17 },
  clearTableButton: { minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});