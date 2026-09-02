import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, BackHandler, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PageHeader, Screen, Surface } from '@/components/WarungUI';
import { useColors } from '@/hooks/useColors';
import { useWarung } from '@/context/WarungContext';
import { useGoogleAccount } from '@/context/GoogleAccountContext';

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
  const {
    isConnected: isAccountConnected,
    email: accountEmail,
    hydrated: accountHydrated,
    request,
    promptAsync,
    clientConfigured: googleClientConfigured,
    logout: logoutGoogle,
  } = useGoogleAccount();
  const [accountSheetVisible, setAccountSheetVisible] = useState(false);
  const [notice, setNotice] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleGoogleConnect = () => {
    if (!googleClientConfigured) {
      setAccountSheetVisible(false);
      setNotice('Google belum dikonfigurasi. Tambahkan Client ID OAuth untuk Web, Android, dan iOS terlebih dahulu.');
      return;
    }
    if (!request) {
      setNotice('Login Google sedang disiapkan. Coba lagi sebentar.');
      return;
    }
    setNotice('Membuka login Google...');
    void promptAsync();
  };

  const handleGoogleDisconnect = () => {
    Alert.alert('Logout akun Google?', 'Koneksi akun Google akan dihapus dari perangkat ini. Data usaha lokal tetap tersimpan.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          void logoutGoogle();
          setAccountSheetVisible(false);
          setNotice('Akun Google sudah logout dari perangkat ini.');
        },
      },
    ]);
  };

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

      <Text style={[s.groupTitle, { color: c.mutedForeground }]}>Akun & sinkronisasi</Text>
      <Pressable
        testID="google-account-button"
        accessibilityRole="button"
        accessibilityLabel={isAccountConnected ? 'Kelola akun Google' : 'Hubungkan akun Google'}
        onPress={() => setAccountSheetVisible(true)}
        style={({ pressed }) => [
          s.accountCard,
          {
            backgroundColor: isAccountConnected ? c.primary : c.card,
            borderColor: isAccountConnected ? c.primary : c.border,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <View style={[s.accountIcon, { backgroundColor: isAccountConnected ? c.primaryForeground : c.secondary }]}>
          <Ionicons
            name="logo-google"
            size={23}
            color={isAccountConnected ? c.primary : c.mutedForeground}
          />
        </View>
        <View style={s.accountCopy}>
          <Text style={[s.accountTitle, { color: isAccountConnected ? c.primaryForeground : c.foreground }]}>
            {!accountHydrated ? 'Memuat status akun...' : isAccountConnected ? 'Akun Google terhubung' : 'Hubungkan akun Google'}
          </Text>
          <Text style={[s.accountDetail, { color: isAccountConnected ? c.primaryForeground : c.mutedForeground }]}>
            {!accountHydrated ? 'Mohon tunggu sebentar' : isAccountConnected ? (accountEmail || 'Login berhasil dan siap digunakan') : 'Login aman dengan akun Google'}
          </Text>
        </View>
        <View style={[s.accountStatus, { backgroundColor: isAccountConnected ? c.primaryForeground : c.muted }]}>
          <Ionicons
            name={isAccountConnected ? 'checkmark' : 'arrow-forward'}
            size={17}
            color={isAccountConnected ? c.primary : c.mutedForeground}
          />
        </View>
      </Pressable>

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

      <Modal
        visible={accountSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAccountSheetVisible(false)}
      >
        <View style={[s.sheetBackdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <View style={[s.accountSheet, { backgroundColor: c.card }]}>
            <View style={s.sheetTopline}>
              <View style={[s.sheetGoogleIcon, { backgroundColor: c.secondary }]}>
                <Ionicons name="logo-google" size={25} color={c.primary} />
              </View>
              <Pressable
                testID="close-google-account-sheet"
                accessibilityLabel="Tutup pengaturan akun Google"
                onPress={() => setAccountSheetVisible(false)}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={28} color={c.mutedForeground} />
              </Pressable>
            </View>
            <Text style={[s.sheetKicker, { color: c.primary }]}>AKUN & SINKRONISASI</Text>
            <Text style={[s.sheetTitle, { color: c.foreground }]}>
              {isAccountConnected ? 'Akun Google siap dipakai' : 'Hubungkan akun Google'}
            </Text>
            <Text style={[s.sheetBody, { color: c.mutedForeground }]}>
              Gunakan akun Google untuk mengidentifikasi akun Anda di Kasir Miso. Fitur backup online dapat ditambahkan nanti.
            </Text>

            <View style={[s.privacyNote, { backgroundColor: c.secondary }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={c.primary} />
              <Text style={[s.privacyText, { color: c.secondaryForeground }]}>
                Aplikasi hanya meminta identitas dasar akun: nama dan email.
              </Text>
            </View>

            <Pressable
              testID="google-connect-button"
              accessibilityRole="button"
              accessibilityLabel={isAccountConnected ? 'Ganti akun Google' : 'Hubungkan dengan Google'}
              onPress={handleGoogleConnect}
              style={({ pressed }) => [s.primaryAction, { backgroundColor: c.primary, opacity: pressed ? 0.78 : 1 }]}
            >
              <Ionicons name="logo-google" size={19} color={c.primaryForeground} />
              <Text style={[s.primaryActionText, { color: c.primaryForeground }]}>
                {isAccountConnected ? 'Ganti akun Google' : 'Hubungkan dengan Google'}
              </Text>
            </Pressable>

            {isAccountConnected ? (
              <Pressable
                testID="google-disconnect-button"
                accessibilityRole="button"
                accessibilityLabel="Logout akun Google"
                onPress={handleGoogleDisconnect}
                style={({ pressed }) => [s.secondaryAction, { opacity: pressed ? 0.62 : 1 }]}
              >
                <Text style={[s.secondaryActionText, { color: c.destructive }]}>Logout akun Google</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  shortcutSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  shortcut: { flex: 1, alignItems: 'center', paddingVertical: 7 },
  shortcutIcon: { width: 58, height: 58, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  shortcutLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  groupTitle: { fontSize: 13, fontWeight: '600', marginTop: 17, marginBottom: 8, marginLeft: 4 },
  accountCard: { minHeight: 82, borderWidth: 1, borderRadius: 22, padding: 13, flexDirection: 'row', alignItems: 'center' },
  accountIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  accountCopy: { flex: 1, paddingHorizontal: 12 },
  accountTitle: { fontSize: 14, fontWeight: '800' },
  accountDetail: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  accountStatus: { width: 31, height: 31, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  menuCard: { padding: 0, overflow: 'hidden' },
  menuRow: { minHeight: 67, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  menuIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  menuCopy: { flex: 1, paddingRight: 8 },
  menuLabel: { fontSize: 15, fontWeight: '600' },
  menuDetail: { fontSize: 11, marginTop: 3 },
  rowDivider: { height: 1, marginLeft: 65 },
  notice: { minHeight: 44, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  accountSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  sheetTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  sheetGoogleIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sheetKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  sheetTitle: { fontSize: 23, fontWeight: '800', marginTop: 4 },
  sheetBody: { fontSize: 12, lineHeight: 18, marginTop: 7 },
  privacyNote: { minHeight: 52, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 18 },
  privacyText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  primaryAction: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, marginTop: 18 },
  primaryActionText: { fontSize: 14, fontWeight: '800' },
  secondaryAction: { minHeight: 45, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryActionText: { fontSize: 12, fontWeight: '800' },
  actionCard: { minHeight: 148, padding: 17, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  actionIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  actionCopy: { flex: 1 },
  actionTitle: { fontSize: 17, fontWeight: '800' },
  actionBody: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  actionLinkText: { fontSize: 11, fontWeight: '800' },
});