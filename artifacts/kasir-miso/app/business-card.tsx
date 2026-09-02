import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import { PageHeader, PrimaryButton, Screen, Surface, ThemeActions } from '@/components/WarungUI';
import { useColors } from '@/hooks/useColors';

type DesignId = 'signature' | 'heritage' | 'atelier';
type BusinessCardData = { design: DesignId; personName: string; businessName: string; businessAddress: string; businessPhone: string; businessEmail: string };
const BUSINESS_CARD_STORAGE_KEY = 'warung-business-card-v1';

const designs: { id: DesignId; name: string; detail: string }[] = [
  { id: 'signature', name: 'Signature', detail: 'Tegas & modern' },
  { id: 'heritage', name: 'Heritage', detail: 'Hangat & berkarakter' },
  { id: 'atelier', name: 'Atelier', detail: 'Segar & premium' },
];

export default function BusinessCardScreen() {
  const c = useColors();
  const router = useRouter();
  const [design, setDesign] = useState<DesignId>('signature');
  const [personName, setPersonName] = useState('Budi Santoso');
  const [businessName, setBusinessName] = useState('Warung Hari Ini');
  const [businessAddress, setBusinessAddress] = useState('Jl. Melati No. 10');
  const [businessPhone, setBusinessPhone] = useState('0812 3456 7890');
  const [businessEmail, setBusinessEmail] = useState('halo@warunghariini.id');
  const [status, setStatus] = useState('');
  const [downloadStatus, setDownloadStatus] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(BUSINESS_CARD_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as Partial<BusinessCardData>;
        if (saved.design && ['signature', 'heritage', 'atelier'].includes(saved.design)) setDesign(saved.design);
        if (typeof saved.personName === 'string') setPersonName(saved.personName);
        if (typeof saved.businessName === 'string') setBusinessName(saved.businessName);
        if (typeof saved.businessAddress === 'string') setBusinessAddress(saved.businessAddress);
        if (typeof saved.businessPhone === 'string') setBusinessPhone(saved.businessPhone);
        if (typeof saved.businessEmail === 'string') setBusinessEmail(saved.businessEmail);
      } catch {
        setStatus('Data kartu lama tidak dapat dibaca.');
      }
    });
  }, []);

  const palette = design === 'signature'
    ? { background: c.foreground, foreground: c.card, accent: c.primary, accentForeground: c.primaryForeground }
    : design === 'heritage'
      ? { background: c.primary, foreground: c.primaryForeground, accent: c.accent, accentForeground: c.accentForeground }
      : { background: c.accent, foreground: c.accentForeground, accent: c.card, accentForeground: c.primary };

  const cardData: BusinessCardData = { design, personName, businessName, businessAddress, businessPhone, businessEmail };
  const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const cardSvg = () => {
    const bg = escapeXml(palette.background);
    const fg = escapeXml(palette.foreground);
    const accent = escapeXml(palette.accent);
    const soft = escapeXml(palette.foreground + 'C9');
    const name = escapeXml(personName.trim() || 'Nama pemilik');
    const shop = escapeXml(businessName.trim() || 'Nama usaha');
    const address = escapeXml(businessAddress.trim() || 'Alamat usaha');
    const phone = escapeXml(businessPhone.trim() || 'Nomor telepon');
    const email = escapeXml(businessEmail.trim() || 'Alamat email');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760"><rect width="1200" height="760" rx="48" fill="${bg}"/><rect x="72" y="72" width="112" height="112" rx="32" fill="${accent}"/><path d="M101 143h54M109 127h38M118 110l20 30" stroke="${escapeXml(palette.accentForeground)}" stroke-width="10" stroke-linecap="round" fill="none"/><text x="224" y="130" fill="${fg}" font-family="Arial, sans-serif" font-size="42" font-weight="700">${shop}</text><text x="224" y="170" fill="${soft}" font-family="Arial, sans-serif" font-size="23">Rasa yang diingat</text><text x="72" y="518" fill="${fg}" font-family="Arial, sans-serif" font-size="54" font-weight="700">${name}</text><g fill="${soft}" font-family="Arial, sans-serif" font-size="23"><circle cx="86" cy="575" r="5" fill="${accent}"/><text x="108" y="583">${address}</text><circle cx="86" cy="626" r="5" fill="${accent}"/><text x="108" y="634">${phone}</text><circle cx="86" cy="677" r="5" fill="${accent}"/><text x="108" y="685">${email}</text></g></svg>`;
  };

  const saveBusinessCard = async () => {
    try {
      await AsyncStorage.setItem(BUSINESS_CARD_STORAGE_KEY, JSON.stringify(cardData));
      setStatus('Data kartu berhasil disimpan.');
      setDownloadStatus('');
    } catch {
      setStatus('Data kartu belum dapat disimpan. Coba lagi.');
    }
  };

  const downloadBusinessCard = async () => {
    const svg = cardSvg();
    const fileName = `${(businessName.trim() || 'kartu-bisnis').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kartu-bisnis'}.svg`;
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        setDownloadStatus('Kartu berhasil diunduh.');
        return;
      }
      if (!cacheDirectory) throw new Error('Folder sementara tidak tersedia.');
      const fileUri = `${cacheDirectory}${fileName}`;
      await writeAsStringAsync(fileUri, svg);
      await Share.share({ title: 'Kartu bisnis', message: 'Kartu bisnis siap dibagikan.', url: fileUri });
      setDownloadStatus('File kartu siap dibagikan atau disimpan.');
    } catch {
      setDownloadStatus('Kartu belum dapat diunduh. Coba lagi.');
    }
  };

  return (
    <Screen contentBottomInset={false}>
      <PageHeader
        eyebrow="Kartu untuk pelanggan"
        title="Bikin kartu bisnis"
        subtitle="Pilih tampilan yang paling mewakili warung kamu."
        action={
          <View style={s.headerActions}>
            <Pressable accessibilityLabel="Kembali ke Lainnya" hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [s.backButton, { backgroundColor: c.primaryForeground, opacity: pressed ? 0.72 : 1 }]}>
              <Ionicons name="arrow-back" size={20} color={c.primary} />
            </Pressable>
            <ThemeActions />
          </View>
        }
      />

      <Text style={[s.sectionKicker, { color: c.primary }]}>PILIH DESAIN</Text>
      <Text style={[s.sectionTitle, { color: c.foreground }]}>Gaya premium untuk warungmu</Text>
      <View style={s.designList}>
        {designs.map((item) => (
          <Pressable
            key={item.id}
            testID={`business-design-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Pilih desain ${item.name}`}
            onPress={() => setDesign(item.id)}
            style={[s.designOption, { backgroundColor: design === item.id ? c.secondary : c.card, borderColor: design === item.id ? c.primary : c.border }]}
          >
            <View style={[s.designDot, { backgroundColor: item.id === 'signature' ? c.foreground : item.id === 'heritage' ? c.primary : c.accent }]}>
              {design === item.id ? <Ionicons name="checkmark" size={15} color={c.card} /> : null}
            </View>
            <View style={s.designCopy}>
              <Text style={[s.designName, { color: c.foreground }]}>{item.name}</Text>
              <Text style={[s.designDetail, { color: c.mutedForeground }]}>{item.detail}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Surface style={[s.previewSurface, { backgroundColor: c.secondary, borderColor: c.border }]}>
        <Text style={[s.previewLabel, { color: c.mutedForeground }]}>PREVIEW KARTU</Text>
        <View style={[s.businessCard, { backgroundColor: palette.background }]}>
          <View style={s.cardHeader}>
            <View style={[s.cardMark, { backgroundColor: palette.accent }]}>
              <Ionicons name="restaurant-outline" size={25} color={palette.accentForeground} />
            </View>
            <View style={s.cardBusiness}>
              <Text numberOfLines={1} style={[s.cardBusinessName, { color: palette.foreground }]}>{businessName.trim() || 'Nama usaha'}</Text>
              <Text style={[s.cardTagline, { color: palette.foreground + 'B8' }]}>Rasa yang diingat</Text>
            </View>
          </View>
          <View style={s.cardFooter}>
            <Text numberOfLines={1} style={[s.cardName, { color: palette.foreground }]}>{personName.trim() || 'Nama pemilik'}</Text>
            <View style={s.contactList}>
              <View style={s.contactLine}>
                <Ionicons name="location-outline" size={12} color={palette.accent} />
                <Text numberOfLines={1} style={[s.cardDetail, { color: palette.foreground + 'C9' }]}>{businessAddress.trim() || 'Alamat usaha'}</Text>
              </View>
              <View style={s.contactLine}>
                <Ionicons name="call-outline" size={12} color={palette.accent} />
                <Text numberOfLines={1} style={[s.cardDetail, { color: palette.foreground + 'C9' }]}>{businessPhone.trim() || 'Nomor telepon'}</Text>
              </View>
              <View style={s.contactLine}>
                <Ionicons name="mail-outline" size={12} color={palette.accent} />
                <Text numberOfLines={1} style={[s.cardDetail, { color: palette.foreground + 'C9' }]}>{businessEmail.trim() || 'Alamat email'}</Text>
              </View>
            </View>
          </View>
        </View>
      </Surface>

      <Text style={[s.sectionKicker, { color: c.primary }]}>DETAIL KARTU</Text>
      <Text style={[s.label, { color: c.mutedForeground }]}>Nama</Text>
      <TextInput value={personName} onChangeText={setPersonName} placeholder="Contoh: Budi Santoso" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
      <Text style={[s.label, { color: c.mutedForeground }]}>Nama usaha</Text>
      <TextInput value={businessName} onChangeText={setBusinessName} placeholder="Contoh: Warung Hari Ini" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
      <Text style={[s.label, { color: c.mutedForeground }]}>Alamat usaha</Text>
      <TextInput value={businessAddress} onChangeText={setBusinessAddress} placeholder="Contoh: Jl. Melati No. 10" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
      <Text style={[s.label, { color: c.mutedForeground }]}>Nomor telepon</Text>
      <TextInput value={businessPhone} onChangeText={setBusinessPhone} keyboardType="phone-pad" placeholder="Contoh: 0812 3456 7890" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
      <Text style={[s.label, { color: c.mutedForeground }]}>Alamat email</Text>
      <TextInput value={businessEmail} onChangeText={setBusinessEmail} keyboardType="email-address" autoCapitalize="none" placeholder="Contoh: halo@warung.id" placeholderTextColor={c.mutedForeground} style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.card }]} />
      <View style={s.buttonStack}>
        <PrimaryButton testID="save-business-card" onPress={saveBusinessCard} icon="checkmark-circle-outline">Simpan kartu</PrimaryButton>
        <Pressable testID="download-business-card" accessibilityRole="button" accessibilityLabel="Unduh kartu bisnis" onPress={downloadBusinessCard} style={({ pressed }) => [s.downloadButton, { backgroundColor: c.secondary, borderColor: c.border, opacity: pressed ? 0.72 : 1 }]}>
          <Ionicons name="download-outline" size={17} color={c.primary} />
          <Text style={[s.downloadButtonText, { color: c.primary }]}>Unduh kartu</Text>
        </Pressable>
      </View>
      {status ? <Text accessibilityLiveRegion="polite" style={[s.status, { color: c.primary }]}>{status}</Text> : null}
      {downloadStatus ? <Text accessibilityLiveRegion="polite" style={[s.status, { color: c.primary }]}>{downloadStatus}</Text> : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 3 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 4, marginBottom: 12 },
  designList: { gap: 8, marginBottom: 15 },
  designOption: { minHeight: 58, borderWidth: 1, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center' },
  designDot: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  designCopy: { flex: 1 },
  designName: { fontSize: 12, fontWeight: '800' },
  designDetail: { fontSize: 11, marginTop: 3 },
  previewSurface: { padding: 12, marginBottom: 18 },
  previewLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 9 },
  businessCard: { minHeight: 260, borderRadius: 20, padding: 18, justifyContent: 'space-between', boxShadow: '0px 7px 15px rgba(10, 10, 10, 0.14)', elevation: 3 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardMark: { width: 49, height: 49, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cardBusiness: { flex: 1, marginLeft: 10 },
  cardBusinessName: { fontSize: 15, fontWeight: '800' },
  cardTagline: { fontSize: 9, marginTop: 3 },
  cardFooter: { gap: 5 },
  cardName: { fontSize: 21, fontWeight: '800', marginBottom: 2 },
  contactList: { gap: 4 },
  contactLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardDetail: { flex: 1, fontSize: 10 },
  label: { fontSize: 11, fontWeight: '800', marginBottom: 7, marginTop: 8 },
  input: { height: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 13, fontSize: 13, marginBottom: 3 },
  buttonStack: { gap: 9, marginTop: 9 },
  downloadButton: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  downloadButtonText: { fontSize: 12, fontWeight: '800' },
  status: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 10, marginBottom: 6 },
});