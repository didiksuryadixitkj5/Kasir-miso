import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as SecureStore from 'expo-secure-store';
import { Alert, BackHandler, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PageHeader, Screen, Surface } from '@/components/WarungUI';
import { useColors } from '@/hooks/useColors';
import { useWarung } from '@/context/WarungContext';

const OFFLINE_BACKUP_KEY = 'warung-offline-backup-v1';
const ONLINE_BACKUP_KEY = 'warung-online-backup-pending-v1';
const GOOGLE_CONNECTION_KEY = 'warung-google-connection-v1';
const GOOGLE_ACCESS_TOKEN_KEY = 'warung-google-drive-access-token-v1';
const GOOGLE_ACCOUNT_EMAIL_KEY = 'warung-google-account-email-v1';
const LOCAL_ACCOUNT_KEYS = [
  'warung-state-v2',
  'warung-reminders-v1',
  'warung-staff-v1',
  'warung-business-profile-v1',
  'warung-business-card-v1',
  OFFLINE_BACKUP_KEY,
  ONLINE_BACKUP_KEY,
  GOOGLE_CONNECTION_KEY,
  GOOGLE_ACCOUNT_EMAIL_KEY,
];
const GOOGLE_CLIENT_ID_FALLBACK = 'google-client-id-not-configured';
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK;
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || GOOGLE_CLIENT_ID_FALLBACK;
const googleClientConfigured = Platform.select({
  web: Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  ios: Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
  android: Boolean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
  default: false,
});
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
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [isAccountConnected, setIsAccountConnected] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountHydrated, setAccountHydrated] = useState(false);
  const [notice, setNotice] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleWebClientId,
    iosClientId: googleIosClientId,
    androidClientId: googleAndroidClientId,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    selectAccount: true,
  });

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(GOOGLE_CONNECTION_KEY),
      AsyncStorage.getItem(GOOGLE_ACCOUNT_EMAIL_KEY),
      SecureStore.getItemAsync(GOOGLE_ACCESS_TOKEN_KEY),
    ])
      .then(([saved, email, accessToken]) => {
        setIsAccountConnected(saved === 'connected' && Boolean(accessToken));
        setAccountEmail(email ?? '');
      })
      .catch(() => setNotice('Status akun Google belum dapat dimuat.'))
      .finally(() => setAccountHydrated(true));
  }, []);

  useEffect(() => {
    if (accountHydrated && !isAccountConnected) {
      void AsyncStorage.setItem(GOOGLE_CONNECTION_KEY, 'disconnected');
    }
  }, [accountHydrated, isAccountConnected]);

  useEffect(() => {
    if (!response) return;
    if (response.type !== 'success') {
      if (response.type === 'dismiss' || response.type === 'cancel') {
        setNotice('Login Google dibatalkan.');
      } else {
        setNotice('Login Google belum berhasil. Coba lagi.');
      }
      return;
    }

    const accessToken = response.authentication?.accessToken ?? response.params?.access_token;
    if (!accessToken) {
      setNotice('Google tidak mengembalikan akses Drive. Coba lagi.');
      return;
    }

    let mounted = true;
    (async () => {
      try {
        await SecureStore.setItemAsync(GOOGLE_ACCESS_TOKEN_KEY, accessToken);
        let email = '';
        try {
          const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (profileResponse.ok) {
            const profile = (await profileResponse.json()) as { email?: string };
            email = profile.email ?? '';
          }
        } catch {
          // The Drive connection is still valid even if profile lookup is unavailable.
        }
        await Promise.all([
          AsyncStorage.setItem(GOOGLE_CONNECTION_KEY, 'connected'),
          AsyncStorage.setItem(GOOGLE_ACCOUNT_EMAIL_KEY, email),
        ]);
        if (mounted) {
          setAccountEmail(email);
          setIsAccountConnected(true);
          setAccountPickerVisible(false);
          setNotice(email ? `Akun ${email} berhasil terhubung ke Google Drive.` : 'Akun Google berhasil terhubung ke Google Drive.');
        }
      } catch {
        if (mounted) setNotice('Koneksi Google belum dapat disimpan. Coba lagi.');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [response]);

  const createBackup = (target: 'offline' | 'online') => ({
    format: 'kasir-miso-backup',
    version: 1,
    target,
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

  const handleGoogleConnect = () => {
    if (!googleClientConfigured) {
      setAccountPickerVisible(false);
      setNotice('Login Google belum dikonfigurasi untuk aplikasi aktif. Tambahkan Client ID Google Cloud terlebih dahulu.');
      return;
    }
    if (!request) {
      setNotice('Login Google sedang disiapkan. Coba lagi sebentar.');
      return;
    }
    setNotice('Membuka login Google...');
    void promptAsync();
  };

  const handleOfflineBackup = async () => {
    setIsBackingUp(true);
    try {
      const backup = createBackup('offline');
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

  const handleOnlineBackup = async () => {
    if (!isAccountConnected) {
      setNotice('Hubungkan akun Google dulu untuk menyiapkan backup online.');
      setAccountPickerVisible(true);
      return;
    }

    setIsBackingUp(true);
    try {
      const accessToken = await SecureStore.getItemAsync(GOOGLE_ACCESS_TOKEN_KEY);
      if (!accessToken) {
        setIsAccountConnected(false);
        setNotice('Sesi Google sudah berakhir. Hubungkan akun Google kembali.');
        setAccountPickerVisible(true);
        return;
      }

      const backup = createBackup('online');
      const backupJson = JSON.stringify(backup);
      const filename = `kasir-miso-backup-${backup.createdAt.slice(0, 10)}.json`;
      const formData = new FormData();
      formData.append('metadata', new Blob([
        JSON.stringify({ name: filename, mimeType: 'application/json' }),
      ], { type: 'application/json' }));
      formData.append('file', new Blob([backupJson], { type: 'application/json' }), filename);

      const uploadResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        },
      );
      if (uploadResponse.status === 401 || uploadResponse.status === 403) {
        await SecureStore.deleteItemAsync(GOOGLE_ACCESS_TOKEN_KEY);
        setIsAccountConnected(false);
        setAccountEmail('');
        setNotice('Akses Google Drive ditolak atau sudah berakhir. Hubungkan akun Google kembali.');
        setAccountPickerVisible(true);
        return;
      }
      if (!uploadResponse.ok) throw new Error(`Drive upload failed: ${uploadResponse.status}`);

      const uploadedFile = (await uploadResponse.json()) as { id?: string; name?: string; webViewLink?: string };
      await AsyncStorage.setItem(ONLINE_BACKUP_KEY, JSON.stringify({ ...backup, uploadedFile }));
      setNotice('Backup online berhasil disimpan ke Google Drive.');
    } catch {
      setNotice('Backup online belum berhasil. Coba lagi.');
    } finally {
      setIsBackingUp(false);
    }
  };

  const showComingSoon = (label: string) => {
    setNotice(`${label} belum tersedia. Tombolnya sudah disiapkan untuk pengembangan berikutnya.`);
  };

  const handleLogout = () => {
    Alert.alert('Hapus akun saya?', 'Semua data usaha di perangkat ini, termasuk pesanan, stok, profil, staf, pengingat, dan koneksi Google, akan dihapus permanen. File backup yang sudah terunggah ke Google Drive tidak ikut dihapus.', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus akun',
        style: 'destructive',
        onPress: () => void deleteAccount(),
      },
    ]);
  };

  const deleteAccount = async () => {
    try {
      await Promise.all([
        AsyncStorage.multiRemove(LOCAL_ACCOUNT_KEYS),
        SecureStore.deleteItemAsync(GOOGLE_ACCESS_TOKEN_KEY),
      ]);
      warung.resetData();
      setIsAccountConnected(false);
      setAccountEmail('');
      setAccountPickerVisible(false);
      setNotice('Akun dan semua data lokal sudah dihapus dari perangkat ini.');
    } catch {
      setNotice('Akun belum dapat dihapus sepenuhnya. Coba lagi.');
    }
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

      <Text style={[s.groupTitle, { color: c.mutedForeground }]}>Akun & keanggotaan</Text>
      <Surface style={s.menuCard}>
        <MenuRow
          icon="person-outline"
          label="Akun Saya"
          detail={isAccountConnected ? (accountEmail || 'Google Drive terhubung') : 'Hubungkan akun Google'}
          testID="google-login-button"
          onPress={() => setAccountPickerVisible(true)}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="person-remove-outline"
          label="Hapus akun saya"
          detail="Hapus semua data usaha dari perangkat"
          testID="delete-account-button"
          onPress={handleLogout}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="ribbon-outline"
          label="Langganan"
          onPress={() => showComingSoon('Langganan')}
        />
      </Surface>

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
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <MenuRow
          icon="cloud-upload-outline"
          label="Backup Online"
          detail={isAccountConnected ? 'Siap disiapkan untuk sinkronisasi' : 'Hubungkan akun Google terlebih dahulu'}
          testID="online-backup-button"
          disabled={isBackingUp}
          onPress={() => void handleOnlineBackup()}
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
        visible={accountPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAccountPickerVisible(false)}
      >
        <View style={[s.modalBackdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <View style={[s.accountModal, { backgroundColor: c.card }]}>
            <View style={s.modalTopline}>
              <View style={[s.modalGoogleMark, { backgroundColor: c.secondary }]}>
                <Ionicons name="logo-google" size={22} color={c.primary} />
              </View>
              <Pressable
                accessibilityLabel="Tutup login Google"
                onPress={() => setAccountPickerVisible(false)}
              >
                <Ionicons name="close-circle" size={27} color={c.mutedForeground} />
              </Pressable>
            </View>
            <Text style={[s.modalKicker, { color: c.primary }]}>LOGIN GOOGLE</Text>
            <Text style={[s.modalTitle, { color: c.foreground }]}>Pilih akun untuk masuk</Text>
            <Text style={[s.modalBody, { color: c.mutedForeground }]}>
              Gunakan satu akun Google untuk menyimpan data Kasir Miso.
            </Text>

            <Pressable
              testID="google-account-option"
              accessibilityRole="button"
              accessibilityLabel={isAccountConnected ? 'Ganti akun Google' : 'Hubungkan akun Google Drive'}
              onPress={handleGoogleConnect}
              style={({ pressed }) => [
                s.accountOption,
                { backgroundColor: c.secondary, borderColor: c.border, opacity: pressed ? 0.72 : 1 },
              ]}
            >
              <View style={[s.avatar, { backgroundColor: c.primary }]}>
                <Text style={[s.avatarText, { color: c.primaryForeground }]}>M</Text>
              </View>
              <View style={s.connectedCopy}>
                <Text style={[s.connectedName, { color: c.foreground }]}>
                  {isAccountConnected ? 'Akun Google terhubung' : 'Hubungkan akun Google Drive'}
                </Text>
                <Text style={[s.connectedEmail, { color: c.mutedForeground }]}>
                  {isAccountConnected && accountEmail ? accountEmail : 'Pilih akun saat aplikasi aktif'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={c.primary} />
            </Pressable>

            <Text style={[s.previewNote, { color: c.mutedForeground }]}>
              Login dibuka saat aplikasi aktif. Data aplikasi tidak dibagikan ke akun Google selain file backup yang Anda minta.
            </Text>
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
  menuCard: { padding: 0, overflow: 'hidden' },
  menuRow: { minHeight: 67, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center' },
  menuIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  menuCopy: { flex: 1, paddingRight: 8 },
  menuLabel: { fontSize: 15, fontWeight: '600' },
  menuDetail: { fontSize: 11, marginTop: 3 },
  rowDivider: { height: 1, marginLeft: 65 },
  notice: { minHeight: 44, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '800' },
  connectedCopy: { flex: 1, marginLeft: 11 },
  connectedName: { fontSize: 13, fontWeight: '800' },
  connectedEmail: { fontSize: 11, marginTop: 3 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 16 },
  accountModal: { borderRadius: 24, padding: 20 },
  modalTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalGoogleMark: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  modalBody: { fontSize: 12, lineHeight: 18, marginTop: 6 },
  accountOption: { minHeight: 64, borderWidth: 1, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  previewNote: { fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 14 },
  actionCard: { minHeight: 148, padding: 17, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  actionIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  actionCopy: { flex: 1 },
  actionTitle: { fontSize: 17, fontWeight: '800' },
  actionBody: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  actionLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  actionLinkText: { fontSize: 11, fontWeight: '800' },
});