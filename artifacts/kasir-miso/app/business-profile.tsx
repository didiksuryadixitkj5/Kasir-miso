import React, { ReactNode, useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PageHeader, Screen, Surface, ThemeActions } from '@/components/WarungUI';
import { useColors } from '@/hooks/useColors';
import { persistImageAsset } from '@/utils/persistentImage';

const BUSINESS_PROFILE_STORAGE_KEY = 'warung-business-profile-v1';

type EditableField = 'businessName' | 'phone' | 'email' | 'category' | 'businessType' | 'address';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type BusinessProfile = {
  logoUri?: string;
  businessName: string;
  phone: string;
  email: string;
  category: string;
  businessType: string;
  address: string;
};

const emptyProfile: BusinessProfile = {
  businessName: '',
  phone: '',
  email: '',
  category: '',
  businessType: '',
  address: '',
};

const fieldMeta: Record<EditableField, { label: string; placeholder: string }> = {
  businessName: { label: 'Nama Usaha', placeholder: 'Contoh: Warung Miso' },
  phone: { label: 'Nomor Kontak Usaha', placeholder: 'Contoh: 0812 3456 7890' },
  email: { label: 'Email Usaha', placeholder: 'Contoh: halo@warung.id' },
  category: { label: 'Kategori Usaha', placeholder: 'Contoh: Restoran & Kafe' },
  businessType: { label: 'Jenis Usaha', placeholder: 'Contoh: Pengecer' },
  address: { label: 'Alamat Jalan', placeholder: 'Contoh: Jl. Melati No. 10' },
};

function ProfileRow({
  icon,
  label,
  value,
  placeholder,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
  testID: string;
}) {
  const c = useColors();
  const hasValue = Boolean(value.trim());

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hasValue ? value : placeholder}`}
      onPress={onPress}
      style={({ pressed }) => [s.profileRow, { opacity: pressed ? 0.62 : 1 }]}
    >
      <View style={[s.profileIcon, { backgroundColor: c.muted }]}>
        <Ionicons name={icon} size={23} color={c.mutedForeground} />
      </View>
      <View style={s.profileCopy}>
        <Text style={[s.profileLabel, { color: c.mutedForeground }]}>{label}</Text>
        <Text style={[s.profileValue, { color: hasValue ? c.foreground : c.primary }]}>
          {hasValue ? value : placeholder}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={c.mutedForeground} />
    </Pressable>
  );
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, { color: c.mutedForeground }]}>{title}</Text>
      <Surface style={s.profileCard}>{children}</Surface>
    </View>
  );
}

export default function BusinessProfileScreen() {
  const c = useColors();
  const router = useRouter();
  const [profile, setProfile] = useState<BusinessProfile>(emptyProfile);
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const saved = JSON.parse(raw) as Partial<BusinessProfile>;
          setProfile({
            ...emptyProfile,
            ...saved,
            businessName: typeof saved.businessName === 'string' ? saved.businessName : '',
            phone: typeof saved.phone === 'string' ? saved.phone : '',
            email: typeof saved.email === 'string' ? saved.email : '',
            category: typeof saved.category === 'string' ? saved.category : '',
            businessType: typeof saved.businessType === 'string' ? saved.businessType : '',
            address: typeof saved.address === 'string' ? saved.address : '',
          });
        } catch {
          setStatus('Data profil usaha belum dapat dibaca.');
        }
      })
      .catch(() => setStatus('Data profil usaha belum dapat dimuat.'));
  }, []);

  const persistProfile = async (nextProfile: BusinessProfile, message: string) => {
    setProfile(nextProfile);
    try {
      await AsyncStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
      setStatus(message);
    } catch {
      setStatus('Perubahan belum tersimpan. Coba lagi.');
    }
  };

  const openEditor = (field: EditableField) => {
    setEditingField(field);
    setDraft(profile[field]);
    setStatus('');
  };

  const saveField = async () => {
    if (!editingField) return;
    const nextProfile: BusinessProfile = { ...profile, [editingField]: draft.trim() };
    await persistProfile(nextProfile, `${fieldMeta[editingField].label} berhasil diperbarui.`);
    setEditingField(null);
  };

  const uploadLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const logoUri = await persistImageAsset(result.assets[0]);
      await persistProfile({ ...profile, logoUri }, 'Logo usaha berhasil disimpan.');
    } catch {
      Alert.alert('Logo tidak tersedia', 'Logo tidak bisa dipilih. Coba pilih gambar lain.');
    }
  };

  return (
    <Screen contentBottomInset={false}>
      <PageHeader
        eyebrow="Manajemen warung"
        title="Profil usaha"
        subtitle="Atur identitas usaha yang tampil di aplikasi."
        action={
          <View style={s.headerActions}>
            <Pressable
              accessibilityLabel="Kembali ke Lainnya"
              hitSlop={10}
              onPress={() => router.back()}
              style={({ pressed }) => [s.backButton, { backgroundColor: c.primaryForeground, opacity: pressed ? 0.72 : 1 }]}
            >
              <Ionicons name="arrow-back" size={20} color={c.primary} />
            </Pressable>
            <ThemeActions />
          </View>
        }
      />

      <Pressable
        testID="upload-business-logo"
        accessibilityRole="button"
        accessibilityLabel="Unggah logo usaha"
        onPress={uploadLogo}
        style={({ pressed }) => [s.logoSection, { opacity: pressed ? 0.65 : 1 }]}
      >
        <View style={[s.logoCircle, { backgroundColor: c.muted, borderColor: c.border }]}>
          {profile.logoUri ? (
            <Image source={{ uri: profile.logoUri }} style={s.logoImage} />
          ) : (
            <Ionicons name="image-outline" size={30} color={c.mutedForeground} />
          )}
          <View style={[s.logoAdd, { backgroundColor: c.primary, borderColor: c.background }]}>
            <Ionicons name="add" size={22} color={c.primaryForeground} />
          </View>
        </View>
        <Text style={[s.logoLabel, { color: c.primary }]}>Unggah Logo Usaha</Text>
      </Pressable>

      <ProfileSection title="Informasi Dasar">
        <ProfileRow
          icon="storefront-outline"
          label={fieldMeta.businessName.label}
          value={profile.businessName}
          placeholder="Tambah Nama Usaha"
          testID="business-name-row"
          onPress={() => openEditor('businessName')}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <ProfileRow
          icon="call-outline"
          label={fieldMeta.phone.label}
          value={profile.phone}
          placeholder="Tambah Nomor Usaha"
          testID="business-phone-row"
          onPress={() => openEditor('phone')}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <ProfileRow
          icon="mail-outline"
          label={fieldMeta.email.label}
          value={profile.email}
          placeholder="Tambah Email Usaha"
          testID="business-email-row"
          onPress={() => openEditor('email')}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <ProfileRow
          icon="grid-outline"
          label={fieldMeta.category.label}
          value={profile.category}
          placeholder="Tambah Kategori Usaha"
          testID="business-category-row"
          onPress={() => openEditor('category')}
        />
        <View style={[s.rowDivider, { backgroundColor: c.border }]} />
        <ProfileRow
          icon="information-circle-outline"
          label={fieldMeta.businessType.label}
          value={profile.businessType}
          placeholder="Tambah Jenis Usaha"
          testID="business-type-row"
          onPress={() => openEditor('businessType')}
        />
      </ProfileSection>

      <ProfileSection title="Informasi Alamat">
        <ProfileRow
          icon="map-outline"
          label={fieldMeta.address.label}
          value={profile.address}
          placeholder="Tambah Alamat Jalan"
          testID="business-address-row"
          onPress={() => openEditor('address')}
        />
      </ProfileSection>

      <ProfileSection title="Informasi Keuangan">
        <ProfileRow
          icon="wallet-outline"
          label="Akun Kas & Bank"
          value=""
          placeholder="Atur akun pencatatan"
          testID="business-finance-row"
          onPress={() => Alert.alert('Akun Kas & Bank', 'Pengaturan akun kas dan bank akan tersedia di pembaruan berikutnya.')}
        />
      </ProfileSection>

      {status ? (
        <Text accessibilityLiveRegion="polite" style={[s.status, { color: c.primary }]}>
          {status}
        </Text>
      ) : null}

      <Modal
        visible={editingField !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingField(null)}
      >
        <View style={[s.modalBackdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <View style={[s.editorModal, { backgroundColor: c.card }]}>
            <View style={s.modalHeader}>
              <View style={s.modalHeaderCopy}>
                <Text style={[s.modalKicker, { color: c.primary }]}>PROFIL USAHA</Text>
                <Text style={[s.modalTitle, { color: c.foreground }]}>
                  {editingField ? fieldMeta[editingField].label : ''}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Tutup edit profil"
                hitSlop={8}
                onPress={() => setEditingField(null)}
              >
                <Ionicons name="close-circle" size={27} color={c.mutedForeground} />
              </Pressable>
            </View>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              placeholder={editingField ? fieldMeta[editingField].placeholder : ''}
              placeholderTextColor={c.mutedForeground}
              keyboardType={editingField === 'phone' ? 'phone-pad' : editingField === 'email' ? 'email-address' : 'default'}
              autoCapitalize={editingField === 'email' ? 'none' : 'sentences'}
              style={[s.input, { color: c.foreground, backgroundColor: c.background, borderColor: c.border }]}
            />
            <View style={s.modalButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Batal edit profil"
                onPress={() => setEditingField(null)}
                style={({ pressed }) => [s.cancelButton, { borderColor: c.border, opacity: pressed ? 0.72 : 1 }]}
              >
                <Text style={[s.cancelButtonText, { color: c.foreground }]}>Batal</Text>
              </Pressable>
              <Pressable
                testID="save-business-profile-field"
                accessibilityRole="button"
                accessibilityLabel="Simpan perubahan profil"
                onPress={() => void saveField()}
                style={({ pressed }) => [s.saveButton, { backgroundColor: c.primary, opacity: pressed ? 0.72 : 1 }]}
              >
                <Ionicons name="checkmark" size={18} color={c.primaryForeground} />
                <Text style={[s.saveButtonText, { color: c.primaryForeground }]}>Simpan</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 20 },
  logoCircle: { width: 104, height: 104, borderRadius: 52, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 102, height: 102, borderRadius: 51 },
  logoAdd: { position: 'absolute', right: -1, bottom: -1, width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  logoLabel: { fontSize: 15, fontWeight: '700', marginTop: 13 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '500', marginBottom: 10, marginLeft: 3 },
  profileCard: { padding: 0, overflow: 'hidden' },
  profileRow: { minHeight: 82, paddingHorizontal: 15, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' },
  profileIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  profileCopy: { flex: 1, paddingRight: 8 },
  profileLabel: { fontSize: 13, fontWeight: '500' },
  profileValue: { fontSize: 16, fontWeight: '500', marginTop: 4 },
  rowDivider: { height: 1, marginLeft: 67 },
  status: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: -4, marginBottom: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 16 },
  editorModal: { borderRadius: 24, padding: 19 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 15 },
  modalHeaderCopy: { flex: 1, paddingRight: 12 },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  modalTitle: { fontSize: 21, fontWeight: '800', marginTop: 4 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 14 },
  modalButtons: { flexDirection: 'row', gap: 9, marginTop: 12 },
  cancelButton: { flex: 1, minHeight: 47, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { fontSize: 12, fontWeight: '800' },
  saveButton: { flex: 1, minHeight: 47, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  saveButtonText: { fontSize: 12, fontWeight: '800' },
});