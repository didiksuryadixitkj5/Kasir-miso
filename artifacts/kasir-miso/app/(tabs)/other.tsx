import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, BackHandler, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PageHeader, Screen, Surface } from '@/components/WarungUI';
import { useColors } from '@/hooks/useColors';
import { useWarung } from '@/context/WarungContext';

const OFFLINE_BACKUP_KEY = 'warung-offline-backup-v1';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

function MenuRow({
  icon,
  label,
  detail,
  onPress,
  testID,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
}) {
  const c = useColors();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.menuRow, { opacity: pressed || disabled ? 0.58 : 1 }]}
    >
      <View style={[s.menuIcon, { backgroundColor: c.muted }]}>
        <Ionicons name={icon} size={21} color={c.mutedForeground} />
      </View>
      <View style={s.menuCopy}>
        <Text style={[s.menuLabel, { color: c.foreground }]}>{label}</Text>
        {detail ? <Text style={[s.menuDetail, { color: c.mutedForeground }]}>{detail}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.mutedForeground} />
    </Pressable>
  );
}

export default function OtherScreen() {
  const c = useColors();
  const router = useRouter();
  const warung = useWarung();
  const [notice, setNotice] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);

  const createBackup = () => ({
    format: 'kasir-miso-backup',
    version: 1,
    target: 'offline',
    createdAt: new Date().toISOString(),
    data: {
      menus: warung.menus,
      activeOrders: warung.activeOrders,
      kitchenOrders: warung.kitchenOrders,
      inventory: warung.inventory,
      consignments: warung.consignments,
      expenses: warung.expenses,
      sales: warung.sales,
      savingsRules: warung.savingsRules,
      savingsEntries: warung.savingsEntries,
      qrisImageUri: warung.qrisImageUri,
    },
  });

  const handleOfflineBackup = async () => {
    setIsBackingUp(true);
    try {
      const backup = createBackup();
      const backupJson = JSON.stringify(backup);
      await AsyncStorage.setItem(OFFLINE_BACKUP_KEY, backupJson);

      if (Platform.OS === 'web') {
        const blob = new Blob([backupJson], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `kasir-miso-backup-${backup.createdAt.slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        setNotice('Backup offline tersimpan dan file JSON sudah diunduh.');
      } else {
        await Share.share({
          title: 'Backup Kasir Miso',
          message: 'Backup offline tersimpan di perangkat. Simpan file ini jika ingin memindahkannya.',
        });
        setNotice('Backup offline tersimpan di perangkat.');
      }
    } catch {
      setNotice('Backup offline belum berhasil. Coba lagi.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const showComingSoon = (label: string) => {
    setNotice(`${label} belum tersedia. Tombolnya sudah disiapkan untuk pengembangan berikutnya.`);
  };

  const handleCloseApp = () => {
    if (Platform.OS === 'android') {
      Alert.alert('Tutup aplikasi?', 'Aplikasi akan ditutup dari perangkat ini.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Tutup', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return;
    }

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.close();
      setNotice('Tab aplikasi tidak dapat ditutup otomatis dari browser. Silakan tutup tab ini.');
      return;
    }

    setNotice('Di iPhone, aplikasi perlu ditutup melalui pengalih aplikasi.');
  };

  return (
    <Screen>
      <PageHeader
        eyebrow="Alat bantu warung"
        title="Lainnya"
        subtitle="Buat warung lebih mudah dikenali dan pekerjaan harian lebih teratur."
      />

      <View style={s.shortcutSection}>
        {[
          { label: 'Kartu ucapan', icon: 'gift-outline' as IconName, onPress: () => showComingSoon('Kartu ucapan'), testID: 'greeting-card-button' },
          { label: 'Kartu bisnis', icon: 'card-outline' as IconName, onPress: () => router.push('/business-card'), testID: 'business-card-button' },
          { label: 'Pengingat', icon: 'calendar-outline' as IconName, onPress: () => router.push('/reminders'), testID: 'reminder-button' },
        ].map((item) => (
          <Pressable
            key={item.label}
            testID={item.testID}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [s.shortcut, { opacity: pressed ? 0.58 : 1 }]}
          >
            <View style={[s.shortcutIcon, { backgroundColor: c.muted }]}>
              <Ionicons name={item.icon} size={24} color={c.mutedForeground} />
            </View>
            <Text style={[s.shortcutLabel, { color: c.foreground }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[s.groupTitle, { color: c.mutedForeground }]}>Manajemen</Text>
      <Surface style={s.menuCard}>
        <MenuRow icon="business-outline" label="Profil Usaha" onPress={() => router.push('/business-profile')} />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow icon="people-outline" label="Kelola Staf" onPress={() => router.push('/staff')} />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow icon="wallet-outline" label="Akun Kas & Bank" onPress={() => showComingSoon('Akun kas & bank')} />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow icon="grid-outline" label="Kelola Kategori" onPress={() => router.push('/inventory')} />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow icon="bar-chart-outline" label="Lihat Laporan" onPress={() => router.push('/reports')} />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="settings-outline"
          label="Pengaturan"
          testID="settings-button"
          onPress={() => router.push('/settings')}
        />
      </Surface>

      <Text style={[s.groupTitle, { color: c.mutedForeground }]}>Utilitas</Text>
      <Surface style={s.menuCard}>
        <MenuRow
          icon="download-outline"
          label="Backup Offline"
          detail="Simpan salinan data di perangkat"
          testID="offline-backup-button"
          disabled={isBackingUp}
          onPress={() => void handleOfflineBackup()}
        />
      </Surface>

      <Text style={[s.groupTitle, { color: c.mutedForeground }]}>Lainnya</Text>
      <Surface style={s.menuCard}>
        <MenuRow
          icon="information-circle-outline"
          label="Informasi"
          testID="information-button"
          onPress={() => Alert.alert('Informasi', 'Kasir Miso membantu mencatat penjualan, stok, biaya, dan laporan warung dalam satu aplikasi.')}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="archive-outline"
          label="Cadangan"
          detail="Buat salinan data warung"
          testID="additional-backup-button"
          disabled={isBackingUp}
          onPress={() => void handleOfflineBackup()}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="help-circle-outline"
          label="Tentang aplikasi ini"
          testID="about-app-button"
          onPress={() => Alert.alert('Tentang Kasir Miso', 'Kasir Miso · Versi 4.5.8\nAplikasi kasir sederhana untuk membantu warung bekerja lebih teratur.')}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="power-outline"
          label="Tutup aplikasi"
          detail="Keluar dari aplikasi ini"
          testID="close-app-button"
          onPress={handleCloseApp}
        />
      </Surface>

      {notice ? (
        <View style={[s.notice, { backgroundColor: c.secondary }]}>
          <Ionicons name="information-circle-outline" size={17} color={c.primary} />
          <Text style={[s.noticeText, { color: c.secondaryForeground }]}>{notice}</Text>
        </View>
      ) : null}

    </Screen>
  );
}

const s = StyleSheet.create({
  shortcutSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  shortcut: { flex: 1, alignItems: 'center', paddingVertical: 7 },
  shortcutIcon: { width: 58, height: 58, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  shortcutLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  groupTitle: { fontSize: 13, fontWeight: '600', marginTop: 17, marginBottom: 8, marginLeft: 4 },
  menuCard: { padding: 0, overflow: 'hidden' },
  menuRow: { minHeight: 67, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  menuIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  menuCopy: { flex: 1, paddingRight: 8 },
  menuLabel: { fontSize: 15, fontWeight: '600' },
  menuDetail: { fontSize: 11, marginTop: 3 },
  rowDivider: { height: 1, marginLeft: 65 },
  notice: { minHeight: 44, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  actionCard: { minHeight: 148, padding: 17, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  actionIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  actionCopy: { flex: 1 },
  actionTitle: { fontSize: 17, fontWeight: '800' },
  actionBody: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  actionLinkText: { fontSize: 11, fontWeight: '800' },
});