import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatRp, isDateInReportPeriod, ReportPeriod, useWarung } from '@/context/WarungContext';
import { useColors } from '@/hooks/useColors';
import { EmptyState, IconButton, PageHeader, PrimaryButton, Screen, SectionHeader, Surface } from '@/components/WarungUI';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';

export default function ExpensesScreen() {
  const c = useColors();
  const { expenses, inventory, savingsRules, savingsEntries, addExpense, addSavingsRule, addManualSaving, useSavings, deleteSavingsRule } = useWarung();
  const [period, setPeriod] = useState<ReportPeriod>('Hari ini');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [savingName, setSavingName] = useState('');
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null);
  const [savingAmount, setSavingAmount] = useState('');
  const [manualSavingName, setManualSavingName] = useState('');
  const [manualSavingAmount, setManualSavingAmount] = useState('');
  const [savingRuleOpen, setSavingRuleOpen] = useState(false);
  const [manualSavingOpen, setManualSavingOpen] = useState(false);
  const [spendingSaving, setSpendingSaving] = useState<{ id: string; type: 'rule' | 'manual' | 'consignment'; name: string; available: number } | null>(null);
  const [spendingAmount, setSpendingAmount] = useState('');
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const periodExpenses = expenses.filter((expense) => isDateInReportPeriod(expense.date, period));
  const periodTotal = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const savingsTotal = savingsRules.reduce((sum, rule) => sum + rule.savedAmount, 0) + savingsEntries.filter((entry) => !entry.inventoryId).reduce((sum, entry) => sum + entry.amount, 0);
  const manualSavingEntries = savingsEntries.filter((entry) => !entry.inventoryId && !entry.consignmentId);
  const manualSavingGroups = Array.from(new Set(manualSavingEntries.map((entry) => entry.name))).map((name) => {
    const entries = manualSavingEntries.filter((entry) => entry.name === name);
    return {
      name,
      amount: entries.reduce((sum, entry) => sum + entry.amount, 0),
      latestDate: entries[entries.length - 1]?.date || '',
    };
  });
  const consignmentSavingEntries = savingsEntries.filter((entry) => entry.consignmentId);
  const consignmentSavingGroups = Array.from(new Set(consignmentSavingEntries.map((entry) => entry.consignmentId).filter((id): id is string => Boolean(id)))).map((id) => {
    const entries = consignmentSavingEntries.filter((entry) => entry.consignmentId === id);
    return {
      id,
      name: entries[0]?.name || 'Bayar penitip',
      amount: entries.reduce((sum, entry) => sum + entry.amount, 0),
      latestDate: entries[entries.length - 1]?.date || '',
    };
  });
  const periodCopy = period === 'Hari ini'
    ? 'Pengeluaran yang tercatat hari ini'
    : period === 'Minggu ini'
      ? 'Pengeluaran dari Senin sampai hari ini'
      : 'Pengeluaran sejak awal bulan ini';
  const formatExpenseDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const save = () => {
    if (!title.trim() || Number(amount) <= 0) {
      Alert.alert('Pengeluaran belum lengkap', 'Isi nama pengeluaran dan nominal yang valid.');
      return;
    }
    addExpense(title.trim(), Number(amount));
    setTitle('');
    setAmount('');
    Alert.alert('Tersimpan', 'Pengeluaran sudah masuk laporan owner.');
  };
  const saveManualSaving = () => {
    const value = Number(manualSavingAmount);
    if (!manualSavingName.trim() || !Number.isFinite(value) || value <= 0) {
      Alert.alert('Penyisihan belum lengkap', 'Isi nama penyisihan khusus dan nominal yang valid.');
      return;
    }
    addManualSaving(manualSavingName.trim(), value);
    setManualSavingName('');
    setManualSavingAmount('');
    setManualSavingOpen(false);
    Alert.alert('Penyisihan tersimpan', 'Penyisihan manual sudah masuk laporan.');
  };
  const openManualSaving = (name = '') => {
    setManualSavingName(name);
    setManualSavingAmount('');
    setManualSavingOpen(true);
  };
  const openSavingsSpend = (id: string, type: 'rule' | 'manual' | 'consignment', name: string, available: number) => {
    setSpendingSaving({ id, type, name, available });
    setSpendingAmount('');
  };
  const saveSavingsSpend = () => {
    const value = Number(spendingAmount);
    if (!spendingSaving || !Number.isFinite(value) || value <= 0) {
      Alert.alert('Nominal belum lengkap', 'Isi nominal belanja yang valid.');
      return;
    }
    if (value > spendingSaving.available) {
      Alert.alert('Saldo tidak cukup', `Maksimal yang bisa dipakai adalah ${formatRp(spendingSaving.available)}.`);
      return;
    }
    useSavings(spendingSaving.id, spendingSaving.type, value);
    setSpendingSaving(null);
    setSpendingAmount('');
    Alert.alert('Dana dipakai', 'Pemakaian dana sudah dicatat sebagai belanja.');
  };
  const saveSavingsRule = () => {
    const amountPerItem = Number(savingAmount);
    if (!savingName.trim() || !selectedInventoryId || !Number.isFinite(amountPerItem) || amountPerItem <= 0) {
      Alert.alert('Aturan belum lengkap', 'Isi nama penyisihan, pilih bahan stok, dan isi nominal per satuan.');
      return;
    }
    if (savingsRules.some((rule) => rule.inventoryId === selectedInventoryId)) {
      Alert.alert('Aturan sudah ada', 'Bahan stok ini sudah memiliki aturan penyisihan.');
      return;
    }
    addSavingsRule(savingName.trim(), selectedInventoryId, amountPerItem);
    setSavingName('');
    setSelectedInventoryId(null);
    setSavingAmount('');
    setSavingRuleOpen(false);
    Alert.alert('Aturan tersimpan', 'Dana akan otomatis disisihkan setiap menu ini dibayar.');
  };
  return (
    <Screen
      footerBorder={false}
      footer={
        <View style={s.actionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Tambah penyisihan biasa" onPress={() => setSavingRuleOpen(true)} style={({ pressed }) => [s.action, { backgroundColor: c.primary, opacity: pressed ? 0.75 : 1 }]}>
            <Ionicons name="sparkles-outline" size={18} color={c.primaryForeground} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Tambah penyisihan khusus" onPress={() => openManualSaving()} style={({ pressed }) => [s.action, { backgroundColor: c.accent, opacity: pressed ? 0.75 : 1 }]}>
            <Ionicons name="wallet-outline" size={18} color={c.accentForeground} />
          </Pressable>
        </View>
      }
    >
      <PageHeader eyebrow="Operasional" title="Pencatatan biaya" subtitle="Satu catatan kecil membantu warung tetap sehat." />
      <View style={s.periodSection}>
        <View style={s.periodHeader}>
          <View>
            <Text style={[s.periodKicker, { color: c.primary }]}>RINGKASAN PERIODE</Text>
            <Text style={[s.periodTitle, { color: c.foreground }]}>Pilih rentang catatan</Text>
          </View>
          <Ionicons name="calendar-outline" size={20} color={c.primary} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.periods}>
          {(['Hari ini', 'Minggu ini', 'Bulan ini'] as ReportPeriod[]).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: period === item }}
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
              <Text style={[s.periodText, { color: period === item ? c.primaryForeground : c.mutedForeground }]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Surface style={s.periodSummary}>
          <View style={[s.periodIcon, { backgroundColor: c.secondary }]}>
            <Ionicons name="trending-down-outline" size={22} color={c.primary} />
          </View>
          <View style={s.periodSummaryCopy}>
            <Text style={[s.periodSummaryLabel, { color: c.mutedForeground }]}>{period.toUpperCase()}</Text>
            <Text style={[s.periodValue, { color: c.foreground }]}>{formatRp(periodTotal)}</Text>
            <Text style={[s.periodDescription, { color: c.mutedForeground }]}>{periodCopy}</Text>
          </View>
          <View style={[s.periodCount, { backgroundColor: c.muted }]}>
            <Text style={[s.periodCountValue, { color: c.foreground }]}>{periodExpenses.length}</Text>
            <Text style={[s.periodCountLabel, { color: c.mutedForeground }]}>catatan</Text>
          </View>
        </Surface>
      </View>
      <Surface style={s.form}>
        <View style={[s.formIcon, { backgroundColor: c.secondary }]}><Ionicons name="receipt-outline" size={20} color={c.primary} /></View>
        <Text style={[s.formTitle, { color: c.foreground }]}>Catat pengeluaran</Text>
        <Text style={[s.formSub, { color: c.mutedForeground }]}>Gas, bahan tambahan, atau kebutuhan harian.</Text>
        <Text style={[s.label, { color: c.mutedForeground }]}>Nama pengeluaran</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="Contoh: beli gas LPG" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
        <Text style={[s.label, { color: c.mutedForeground }]}>Nominal</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" placeholder="Rp 0" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
        <PrimaryButton onPress={save} icon="save-outline">Simpan pengeluaran</PrimaryButton>
      </Surface>
      <SectionHeader title={`Riwayat ${period.toLowerCase()}`} meta={`${formatRp(periodTotal)} · ${periodExpenses.length} catatan`} icon="list-outline" />
      {!expenses.length ? <EmptyState icon="wallet-outline" title="Belum ada pengeluaran" body="Catatan biaya harian yang tersimpan akan muncul di sini." /> : !periodExpenses.length ? <EmptyState icon="calendar-outline" title={`Belum ada catatan ${period.toLowerCase()}`} body={`Belum ada pengeluaran yang tercatat untuk ${periodCopy.toLowerCase()}.`} /> : periodExpenses.slice().reverse().map((expense) => <Surface key={expense.id} style={s.item}><View style={[s.icon, { backgroundColor: c.secondary }]}><Ionicons name="receipt-outline" size={19} color={c.primary} /></View><View style={s.flex}><Text style={[s.name, { color: c.foreground }]}>{expense.title}</Text><Text style={[s.sub, { color: c.mutedForeground }]}>{formatExpenseDate(expense.date)}</Text></View><Text style={[s.amount, { color: c.foreground }]}>{formatRp(expense.amount)}</Text></Surface>)}
      <SectionHeader title="Dana disisihkan" meta={formatRp(savingsTotal)} icon="wallet-outline" />
       {!savingsRules.length && !savingsEntries.some((entry) => !entry.inventoryId) ? <EmptyState icon="wallet-outline" title="Belum ada dana disisihkan" body="Tambahkan aturan otomatis atau penyisihan khusus untuk memisahkan dana." /> : savingsRules.map((rule) => {
         const stock = inventory.find((item) => item.id === rule.inventoryId);
          return <Surface key={rule.id} style={s.item}><View style={[s.icon, { backgroundColor: c.secondary }]}><Ionicons name="wallet-outline" size={19} color={c.primary} /></View><View style={s.flex}><Text style={[s.name, { color: c.foreground }]}>{rule.name}</Text><Text style={[s.sub, { color: c.mutedForeground }]}>{stock?.name || 'Bahan dihapus'} · {rule.savedQty || 0} {stock?.unit || 'satuan'} × {formatRp(rule.amountPerItem)}</Text></View><View style={s.savingsRight}><Text style={[s.amount, { color: c.primary }]}>{formatRp(rule.savedAmount)}</Text><View style={s.inlineActions}><IconButton icon="cart-outline" tone="primary" label={`Pakai ${rule.name} untuk belanja`} onPress={() => openSavingsSpend(rule.id, 'rule', rule.name, rule.savedAmount)} /><IconButton icon="trash-outline" label={`Hapus aturan ${rule.name}`} onPress={() => deleteSavingsRule(rule.id)} /></View></View></Surface>;
       })}
          {manualSavingGroups.map((saving) => <Surface key={saving.name} style={s.item}><View style={[s.icon, { backgroundColor: c.accent }]}><Ionicons name="wallet-outline" size={19} color={c.accentForeground} /></View><View style={s.flex}><Text style={[s.name, { color: c.foreground }]}>{saving.name}</Text><Text style={[s.sub, { color: c.mutedForeground }]}>Penyisihan manual · terakhir {saving.latestDate}</Text></View><View style={s.savingsRight}><Text style={[s.amount, { color: c.primary }]}>{formatRp(saving.amount)}</Text><View style={s.inlineActions}><IconButton icon="cart-outline" tone="primary" label={`Pakai ${saving.name} untuk belanja`} onPress={() => openSavingsSpend(saving.name, 'manual', saving.name, saving.amount)} /><IconButton icon="add" tone="primary" label={`Tambah penyisihan untuk ${saving.name}`} onPress={() => openManualSaving(saving.name)} /></View></View></Surface>)}
          {consignmentSavingGroups.map((saving) => <Surface key={saving.id} style={s.item}><View style={[s.icon, { backgroundColor: c.secondary }]}><Ionicons name="storefront-outline" size={19} color={c.primary} /></View><View style={s.flex}><Text style={[s.name, { color: c.foreground }]}>{saving.name}</Text><Text style={[s.sub, { color: c.mutedForeground }]}>Harga beli penitip · terakhir {saving.latestDate}</Text></View><View style={s.savingsRight}><Text style={[s.amount, { color: c.primary }]}>{formatRp(saving.amount)}</Text><IconButton icon="cart-outline" tone="primary" label={`Pakai dana ${saving.name} untuk belanja`} onPress={() => openSavingsSpend(saving.id, 'consignment', saving.name, saving.amount)} /></View></Surface>)}
         <Modal visible={!!spendingSaving} transparent animationType="slide" onRequestClose={() => setSpendingSaving(null)}>
           <View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}>
             <KeyboardAwareScrollViewCompat style={s.modalScroll} contentContainerStyle={s.modalScrollContent} keyboardShouldPersistTaps="handled" bottomOffset={20}>
               <View style={[s.modal, { backgroundColor: c.card }]}>
                 <View style={s.modalHead}><View><Text style={[s.modalKicker, { color: c.primary }]}>PAKAI DANA</Text><Text style={[s.modalTitle, { color: c.foreground }]}>Untuk belanja</Text></View><Pressable accessibilityLabel="Tutup pemakaian dana" hitSlop={12} onPress={() => setSpendingSaving(null)}><Ionicons name="close-circle" size={27} color={c.mutedForeground} /></Pressable></View>
                 <Text style={[s.formSub, { color: c.mutedForeground }]}>{spendingSaving?.name || ''} · tersedia {spendingSaving ? formatRp(spendingSaving.available) : formatRp(0)}. Pemakaian akan masuk ke riwayat pengeluaran.</Text>
                 <Text style={[s.label, { color: c.mutedForeground }]}>Nominal belanja</Text>
                 <TextInput autoFocus value={spendingAmount} onChangeText={setSpendingAmount} keyboardType="number-pad" placeholder="Rp 0" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
                 <PrimaryButton onPress={saveSavingsSpend} icon="cart-outline">Pakai untuk belanja</PrimaryButton>
               </View>
             </KeyboardAwareScrollViewCompat>
           </View>
         </Modal>
        <Modal visible={savingRuleOpen} transparent animationType="slide" onRequestClose={() => setSavingRuleOpen(false)}>
          <View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}>
            <KeyboardAwareScrollViewCompat style={s.modalScroll} contentContainerStyle={s.modalScrollContent} keyboardShouldPersistTaps="handled" bottomOffset={20}>
              <View style={[s.modal, { backgroundColor: c.card }]}>
                <View style={s.modalHead}><View><Text style={[s.modalKicker, { color: c.primary }]}>PENYISIHAN BIASA</Text><Text style={[s.modalTitle, { color: c.foreground }]}>Atur penyisihan otomatis</Text></View><Pressable accessibilityLabel="Tutup penyisihan biasa" hitSlop={12} onPress={() => setSavingRuleOpen(false)}><Ionicons name="close-circle" size={27} color={c.mutedForeground} /></Pressable></View>
                <Text style={[s.formSub, { color: c.mutedForeground }]}>Dana otomatis dihitung dari pemakaian bahan stok pada menu yang terjual.</Text>
                <Text style={[s.label, { color: c.mutedForeground }]}>Nama penyisihan</Text>
                <TextInput autoFocus value={savingName} onChangeText={setSavingName} placeholder="Contoh: Tabungan beli gas" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
                <Text style={[s.label, { color: c.mutedForeground }]}>Jenis bahan stok</Text>
                {!inventory.length ? <Text style={[s.emptyText, { color: c.mutedForeground }]}>Buat bahan stok terlebih dahulu di tab Stok.</Text> : <View style={s.menuOptions}>{inventory.map((item) => {
                  const isSelected = selectedInventoryId === item.id;
                  const hasRule = savingsRules.some((rule) => rule.inventoryId === item.id);
                  return <Pressable key={item.id} disabled={hasRule} onPress={() => setSelectedInventoryId(item.id)} style={[s.menuOption, { backgroundColor: isSelected ? c.primary : c.secondary, borderColor: isSelected ? c.primary : c.border, opacity: hasRule ? 0.5 : 1 }]}><Text style={[s.menuOptionText, { color: isSelected ? c.primaryForeground : c.foreground }]}>{item.name} ({item.unit})</Text>{hasRule ? <Ionicons name="checkmark-circle" size={17} color={c.primary} /> : null}</Pressable>;
                })}</View>}
                <Text style={[s.label, { color: c.mutedForeground }]}>Nominal disisihkan per satuan bahan</Text>
                <TextInput value={savingAmount} onChangeText={setSavingAmount} keyboardType="number-pad" placeholder="Contoh: 500" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
                <PrimaryButton onPress={saveSavingsRule} icon="add-circle-outline">Simpan penyisihan biasa</PrimaryButton>
              </View>
            </KeyboardAwareScrollViewCompat>
          </View>
        </Modal>
        <Modal visible={manualSavingOpen} transparent animationType="slide" onRequestClose={() => setManualSavingOpen(false)}>
          <View style={[s.backdrop, { backgroundColor: c.foreground + 'B8' }]}>
            <KeyboardAwareScrollViewCompat style={s.modalScroll} contentContainerStyle={s.modalScrollContent} keyboardShouldPersistTaps="handled" bottomOffset={20}>
              <View style={[s.modal, { backgroundColor: c.card }]}>
                <View style={s.modalHead}><View><Text style={[s.modalKicker, { color: c.accent }]}>PENYISIHAN KHUSUS</Text><Text style={[s.modalTitle, { color: c.foreground }]}>Tambah penyisihan manual</Text></View><Pressable accessibilityLabel="Tutup penyisihan khusus" hitSlop={12} onPress={() => setManualSavingOpen(false)}><Ionicons name="close-circle" size={27} color={c.mutedForeground} /></Pressable></View>
                <Text style={[s.formSub, { color: c.mutedForeground }]}>Gunakan untuk kebutuhan lain atau nominal yang ingin disisihkan langsung.</Text>
                <Text style={[s.label, { color: c.mutedForeground }]}>Nama penyisihan</Text>
                 <TextInput autoFocus={!manualSavingName} value={manualSavingName} onChangeText={setManualSavingName} placeholder="Contoh: Tambahan modal" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
                <Text style={[s.label, { color: c.mutedForeground }]}>Nominal</Text>
                 <TextInput autoFocus={Boolean(manualSavingName)} value={manualSavingAmount} onChangeText={setManualSavingAmount} keyboardType="number-pad" placeholder="Rp 0" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]} />
                <PrimaryButton onPress={saveManualSaving} icon="wallet-outline">Simpan penyisihan khusus</PrimaryButton>
              </View>
            </KeyboardAwareScrollViewCompat>
          </View>
        </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  action: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 8px rgba(10, 10, 10, 0.16)', elevation: 5 },
  periodSection: { marginBottom: 22 },
  periodHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  periodKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  periodTitle: { fontSize: 17, fontWeight: '800', marginTop: 3 },
  periods: { gap: 7, paddingRight: 4, paddingBottom: 12 },
  period: { borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  periodText: { fontSize: 11, fontWeight: '800' },
  periodSummary: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  periodIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  periodSummaryCopy: { flex: 1 },
  periodSummaryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  periodValue: { fontSize: 21, fontWeight: '800', marginTop: 3 },
  periodDescription: { fontSize: 11, marginTop: 2 },
  periodCount: { minWidth: 53, alignItems: 'center', borderRadius: 13, paddingVertical: 8, paddingHorizontal: 6 },
  periodCountValue: { fontSize: 17, fontWeight: '800' },
  periodCountLabel: { fontSize: 10, marginTop: 1 },
  form: { marginBottom: 22 },
  formIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  formTitle: { fontSize: 18, fontWeight: '800' },
  formSub: { fontSize: 12, lineHeight: 18, marginTop: 3, marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 7, marginTop: 8 },
  input: { height: 47, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 14, marginBottom: 4 },
  item: { minHeight: 64, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  icon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  flex: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 11, marginTop: 3 },
  amount: { fontSize: 13, fontWeight: '800' },
  emptyText: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  menuOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 4 },
  menuOption: { minHeight: 38, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuOptionText: { fontSize: 11, fontWeight: '800' },
  savingsRight: { alignItems: 'flex-end', gap: 6 },
  inlineActions: { flexDirection: 'row', gap: 6 },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '90%' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 28 },
  modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginTop: 3 },
});