import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { PrimaryButton, Screen, Surface } from '@/components/WarungUI';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  addReminderToList,
  deleteReminderFromList,
  parseReminderTime,
  readScheduledReminderIndex,
  reminderSignature,
  toggleReminderInList,
  type Reminder,
  type ScheduledReminderIndex,
} from '@/domain/reminders';

type ReminderTab = 'upcoming' | 'completed';
const STORAGE_KEY = 'warung-reminders-v1';
const NOTIFICATION_IDS_STORAGE_KEY = 'warung-reminder-notification-ids-v1';
const ANDROID_NOTIFICATION_CHANNEL = 'reminders-v2';

function isReminderNotification(notification: Notifications.NotificationRequest) {
  return typeof notification.content.data?.reminderId === 'string';
}

async function requestNotificationPermission() {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    return (await Notification.requestPermission()) === 'granted';
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL, {
      name: 'Pengingat',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export default function RemindersScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ReminderTab>('upcoming');
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('08:00');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState('');
  const [notificationSyncVersion, setNotificationSyncVersion] = useState(0);
  const browserNotified = useRef(new Set<string>());
  const notificationSyncQueue = useRef(Promise.resolve());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const saved = JSON.parse(raw) as Reminder[];
          if (Array.isArray(saved)) setReminders(saved);
        } catch {
          setReminders([]);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  }, [hydrated, reminders]);

  const syncNativeNotifications = useCallback(async (items: Reminder[]) => {
    if (Platform.OS === 'web') return { activeCount: 0, expectedCount: 0 };
    const desiredItems = items.filter((item) => !item.completed && parseReminderTime(item.time));
    const desiredIds = new Set(desiredItems.map((item) => item.id));
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      // Removals must still be cleaned up when notification permission is later revoked.
      const [storedIndexRaw, scheduled] = await Promise.all([
        AsyncStorage.getItem(NOTIFICATION_IDS_STORAGE_KEY),
        Notifications.getAllScheduledNotificationsAsync(),
      ]);
      const storedIndex = readScheduledReminderIndex(storedIndexRaw);
      const nextIndex = Object.fromEntries(
        Object.entries(storedIndex).filter(([reminderId]) => desiredIds.has(reminderId)),
      ) as ScheduledReminderIndex;
      await AsyncStorage.setItem(NOTIFICATION_IDS_STORAGE_KEY, JSON.stringify(nextIndex));
      const idsToCancel = new Set(
        Object.entries(storedIndex)
          .filter(([reminderId]) => !desiredIds.has(reminderId))
          .map(([, entry]) => entry.notificationId),
      );
      scheduled.filter(isReminderNotification).forEach((notification) => {
        if (!desiredIds.has(notification.content.data?.reminderId as string)) {
          idsToCancel.add(notification.identifier);
        }
      });
      await Promise.all([...idsToCancel].map((notificationId) => Notifications.cancelScheduledNotificationAsync(notificationId)));
      return { activeCount: 0, expectedCount: desiredItems.length };
    }
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_NOTIFICATION_CHANNEL, {
        name: 'Pengingat',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }

    const [storedIndexRaw, scheduled] = await Promise.all([
      AsyncStorage.getItem(NOTIFICATION_IDS_STORAGE_KEY),
      Notifications.getAllScheduledNotificationsAsync(),
    ]);
    const storedIndex = readScheduledReminderIndex(storedIndexRaw);
    const activeById = new Map(scheduled.map((notification) => [notification.identifier, notification]));
    const nextIndex: ScheduledReminderIndex = {};
    const replacedIds = new Set<string>();

    for (const item of desiredItems) {
      const parsed = parseReminderTime(item.time);
      if (!parsed) continue; // Guard retained for TypeScript and malformed stored records.
      const signature = reminderSignature(item);
      const previous = storedIndex[item.id];
      const previousNotification = previous && activeById.get(previous.notificationId);
      if (
        previous
        && previous.signature === signature
        && previousNotification
        && previousNotification.content.data?.reminderId === item.id
      ) {
        nextIndex[item.id] = previous;
        continue;
      }

      try {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Pengingat Kasir Miso',
            body: item.title,
            sound: 'default',
            data: { reminderId: item.id },
          },
          trigger: Platform.OS === 'android'
            ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...parsed, channelId: ANDROID_NOTIFICATION_CHANNEL }
            : { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...parsed },
        });
        nextIndex[item.id] = { notificationId, signature };
        if (previous?.notificationId) replacedIds.add(previous.notificationId);
      } catch {
        // Keep a working old schedule when a replacement could not be created.
        if (previous && previousNotification) nextIndex[item.id] = previous;
      }
    }

    // Persist new IDs before removing any prior schedules so a failed replacement never loses an alarm.
    await AsyncStorage.setItem(NOTIFICATION_IDS_STORAGE_KEY, JSON.stringify(nextIndex));

    const idsToCancel = new Set<string>();
    Object.entries(storedIndex).forEach(([reminderId, entry]) => {
      if (!nextIndex[reminderId] || replacedIds.has(entry.notificationId)) idsToCancel.add(entry.notificationId);
    });
    scheduled
      .filter(isReminderNotification)
      .forEach((notification) => {
        const reminderId = notification.content.data?.reminderId as string;
        const current = nextIndex[reminderId];
        if (!desiredIds.has(reminderId) || (current && current.notificationId !== notification.identifier)) {
          idsToCancel.add(notification.identifier);
        }
      });
    await Promise.all([...idsToCancel].map((notificationId) => Notifications.cancelScheduledNotificationAsync(notificationId)));

    const verified = await Notifications.getAllScheduledNotificationsAsync();
    const activeCount = desiredItems.filter((item) => {
      const entry = nextIndex[item.id];
      const notification = entry && verified.find((candidate) => candidate.identifier === entry.notificationId);
      return notification?.content.data?.reminderId === item.id;
    }).length;
    return { activeCount, expectedCount: desiredItems.length };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const snapshot = reminders;
    notificationSyncQueue.current = notificationSyncQueue.current
      .then(async () => {
        const { activeCount, expectedCount } = await syncNativeNotifications(snapshot);
        if (Platform.OS !== 'web' && expectedCount > 0 && activeCount !== expectedCount) {
          setNotice('Sebagian pengingat belum berhasil dijadwalkan. Aktifkan izin Alarm & pengingat di pengaturan perangkat.');
        } else if (Platform.OS !== 'web' && expectedCount > 0) {
          setNotice('Pengingat tersimpan dan notifikasi aktif setiap hari.');
        }
      })
      .catch(() => {
        setNotice('Pengingat tersimpan, tetapi alarm perangkat belum dapat dijadwalkan. Aktifkan izin Alarm & pengingat di pengaturan perangkat.');
      });
  }, [hydrated, reminders, notificationSyncVersion, syncNativeNotifications]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !hydrated) return;
    const checkBrowserReminders = () => {
      if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      reminders.filter((item) => !item.completed && item.time === currentTime).forEach((item) => {
        const key = `${item.id}:${today}`;
        if (browserNotified.current.has(key)) return;
        browserNotified.current.add(key);
        new Notification('Pengingat Kasir Miso', { body: item.title });
      });
    };
    checkBrowserReminders();
    const timer = setInterval(checkBrowserReminders, 30000);
    return () => clearInterval(timer);
  }, [hydrated, reminders]);

  const upcoming = useMemo(() => reminders.filter((item) => !item.completed), [reminders]);
  const completed = useMemo(() => reminders.filter((item) => item.completed), [reminders]);
  const visibleReminders = activeTab === 'upcoming' ? upcoming : completed;

  const addReminder = async () => {
    if (!title.trim()) return;
    if (!parseReminderTime(time)) {
      setNotice('Masukkan waktu dengan format 00:00 sampai 23:59.');
      return;
    }
    const nextReminders = addReminderToList(
      reminders,
      { title, time },
      `${Date.now()}-${Math.random()}`,
    );
    setReminders(nextReminders);
    setNotice('Pengingat tersimpan. Menyiapkan notifikasi...');
    setTitle('');
    setTime('08:00');
    setComposerOpen(false);
    setActiveTab('upcoming');
    try {
      const permissionGranted = await requestNotificationPermission();
      if (!permissionGranted) {
        Alert.alert(
          'Izin notifikasi diperlukan',
          'Pengingat tetap tersimpan, tetapi notifikasi tidak akan muncul sebelum izin notifikasi diberikan.',
        );
      }
    } catch {
      setNotice('Pengingat tersimpan, tetapi izin atau kanal notifikasi belum dapat disiapkan.');
    } finally {
      setNotificationSyncVersion((version) => version + 1);
    }
  };

  const testNotification = async () => {
    try {
      const permissionGranted = await requestNotificationPermission();
      if (!permissionGranted) {
        setNotice('Izin notifikasi belum aktif. Aktifkan notifikasi Kasir Miso di pengaturan perangkat.');
        if (Platform.OS !== 'web') {
          const permission = await Notifications.getPermissionsAsync();
          if (!permission.canAskAgain) {
            Alert.alert(
              'Notifikasi diblokir',
              'Buka pengaturan aplikasi dan aktifkan izin notifikasi serta suara.',
              [
                { text: 'Batal', style: 'cancel' },
                { text: 'Buka pengaturan', onPress: () => void Linking.openSettings() },
              ],
            );
          }
        }
        return;
      }

      if (Platform.OS === 'web') {
        new Notification('Tes Pengingat Kasir Miso', { body: 'Jika pesan ini muncul, notifikasi browser sudah aktif.' });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Tes Pengingat Kasir Miso',
            body: 'Notifikasi dan suara sudah aktif.',
            sound: 'default',
          },
          trigger: Platform.OS === 'android'
            ? {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 1,
                repeats: false,
                channelId: ANDROID_NOTIFICATION_CHANNEL,
              }
            : null,
        });
      }
      setNotice('Notifikasi uji dikirim. Pastikan volume notifikasi perangkat tidak dibisukan.');
    } catch {
      setNotice('Notifikasi uji gagal dikirim. Periksa izin notifikasi di pengaturan perangkat.');
    }
  };

  const toggleReminder = (id: string) => {
    setReminders((items) => toggleReminderInList(items, id));
  };

  const deleteReminder = (id: string) => {
    setReminders((items) => deleteReminderFromList(items, id));
  };

  return (
    <Screen
      footerBorder={false}
      footerBottomInset={false}
      contentBottomInset={false}
      footer={
        <View style={s.fabRow}>
          <Pressable
            testID="open-add-reminder"
            accessibilityRole="button"
            accessibilityLabel={composerOpen ? 'Tutup tambah pengingat' : 'Tambah pengingat'}
            onPress={() => setComposerOpen((open) => !open)}
            style={({ pressed }) => [s.fab, { backgroundColor: c.primary, opacity: pressed ? 0.75 : 1 }]}
          >
            <Ionicons name={composerOpen ? 'close' : 'add'} size={24} color={c.primaryForeground} />
          </Pressable>
        </View>
      }
    >
      <View style={[s.header, { borderBottomColor: c.border }]}>
        <Pressable accessibilityLabel="Kembali ke Lainnya" hitSlop={10} onPress={() => router.back()} style={({ pressed }) => [s.backButton, { opacity: pressed ? 0.58 : 1 }]}>
          <Ionicons name="arrow-back" size={25} color={c.foreground} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.foreground }]}>Pengingat</Text>
        <View style={s.headerSpacer} />
      </View>

      <View style={[s.tabs, { borderBottomColor: c.border }]}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'upcoming' }} onPress={() => setActiveTab('upcoming')} style={s.tab}>
          <Text style={[s.tabText, { color: activeTab === 'upcoming' ? c.primary : c.mutedForeground }]}>Mendatang</Text>
          {activeTab === 'upcoming' ? <View style={[s.tabIndicator, { backgroundColor: c.primary }]} /> : null}
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeTab === 'completed' }} onPress={() => setActiveTab('completed')} style={s.tab}>
          <Text style={[s.tabText, { color: activeTab === 'completed' ? c.primary : c.mutedForeground }]}>Selesai</Text>
          {activeTab === 'completed' ? <View style={[s.tabIndicator, { backgroundColor: c.primary }]} /> : null}
        </Pressable>
      </View>

      {composerOpen ? (
        <Surface style={[s.composer, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[s.composerTitle, { color: c.foreground }]}>Pengingat baru</Text>
          <Text style={[s.composerHint, { color: c.mutedForeground }]}>Notifikasi akan muncul setiap hari pada jam ini.</Text>
          <TextInput
            autoFocus
            value={title}
            onChangeText={setTitle}
            placeholder="Contoh: Cek stok bawang"
            placeholderTextColor={c.mutedForeground}
            style={[s.input, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]}
          />
          <View style={s.composerRow}>
            <TextInput
              value={time}
              onChangeText={setTime}
              keyboardType="numbers-and-punctuation"
              placeholder="08:00"
              placeholderTextColor={c.mutedForeground}
              style={[s.timeInput, { borderColor: c.border, color: c.foreground, backgroundColor: c.background }]}
            />
            <View style={s.composerButton}>
              <PrimaryButton testID="add-reminder" onPress={addReminder} icon="checkmark-circle-outline">Simpan</PrimaryButton>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Uji bunyi notifikasi"
            onPress={() => void testNotification()}
            style={({ pressed }) => [s.testNotificationButton, { borderColor: c.border, opacity: pressed ? 0.65 : 1 }]}
          >
            <Ionicons name="notifications-outline" size={17} color={c.primary} />
            <Text style={[s.testNotificationText, { color: c.primary }]}>Uji bunyi notifikasi</Text>
          </Pressable>
        </Surface>
      ) : null}

      {visibleReminders.length ? (
        <View style={s.list}>
          {visibleReminders.map((item) => (
            <View key={item.id} style={[s.reminderRow, { backgroundColor: c.card, borderColor: c.border }]}>
              <Pressable
                testID={`toggle-reminder-${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={item.completed ? `Kembalikan ${item.title} ke mendatang` : `Tandai ${item.title} selesai`}
                onPress={() => toggleReminder(item.id)}
                style={[s.checkButton, { backgroundColor: item.completed ? c.primary : c.secondary }]}
              >
                <Ionicons name={item.completed ? 'checkmark' : 'ellipse-outline'} size={18} color={item.completed ? c.primaryForeground : c.primary} />
              </Pressable>
              <View style={s.reminderCopy}>
                <Text style={[s.reminderTitle, { color: item.completed ? c.mutedForeground : c.foreground, textDecorationLine: item.completed ? 'line-through' : 'none' }]}>{item.title}</Text>
                <Text style={[s.reminderTime, { color: c.mutedForeground }]}>{item.time}</Text>
              </View>
              <Pressable testID={`delete-reminder-${item.id}`} accessibilityLabel={`Hapus ${item.title}`} hitSlop={10} onPress={() => deleteReminder(item.id)}>
                <Ionicons name="trash-outline" size={18} color={c.destructive} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={s.emptyState}>
          <View style={s.emptyIllustration}>
            <View style={[s.cloud, { backgroundColor: c.secondary }]} />
            <View style={[s.calendar, { backgroundColor: c.card, borderColor: c.muted }]} >
              <View style={[s.calendarTop, { backgroundColor: c.muted }]} />
              <View style={s.calendarGrid}>
                {[0, 1, 2, 3, 4, 5].map((dot) => <View key={dot} style={[s.calendarDot, { backgroundColor: dot % 3 === 0 ? c.muted : c.secondary }]} />)}
              </View>
              <View style={[s.calendarRing, s.calendarRingLeft, { backgroundColor: c.card, borderColor: c.muted }]} />
              <View style={[s.calendarRing, s.calendarRingRight, { backgroundColor: c.card, borderColor: c.muted }]} />
            </View>
            <View style={[s.clock, { backgroundColor: c.muted }]}>
              <Ionicons name="time-outline" size={35} color={c.card} />
            </View>
            <View style={[s.illustrationLine, { backgroundColor: c.muted }]} />
          </View>
          <Text style={[s.emptyTitle, { color: c.foreground }]}>
            {activeTab === 'upcoming' ? 'Tidak Ada Pengingat yang akan datang' : 'Tidak Ada Pengingat yang selesai'}
          </Text>
          <Text style={[s.emptyBody, { color: c.mutedForeground }]}>
            {activeTab === 'upcoming' ? 'Tekan tombol + untuk menambahkan pengingat baru.' : 'Pengingat yang sudah selesai akan tampil di sini.'}
          </Text>
        </View>
      )}
      {notice ? (
        <View style={[s.notice, { backgroundColor: c.secondary }]}>
          <Ionicons name="notifications-outline" size={17} color={c.primary} />
          <Text style={[s.noticeText, { color: c.secondaryForeground }]}>{notice}</Text>
        </View>
      ) : null}
      <View style={{ height: Math.max(0, insets.bottom) }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0 },
  backButton: { width: 42, height: 42, alignItems: 'flex-start', justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '500', flex: 1, marginLeft: 1 },
  headerSpacer: { width: 42 },
  tabs: { height: 58, flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabText: { fontSize: 16, fontWeight: '500' },
  tabIndicator: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2 },
  composer: { padding: 14, marginTop: 15, marginBottom: 8 },
  composerTitle: { fontSize: 15, fontWeight: '800', marginBottom: 9 },
  composerHint: { fontSize: 11, lineHeight: 16, marginTop: -4, marginBottom: 9 },
  input: { height: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, fontSize: 13, marginBottom: 8 },
  composerRow: { flexDirection: 'row', gap: 8 },
  timeInput: { width: 82, height: 46, borderWidth: 1, borderRadius: 13, paddingHorizontal: 10, fontSize: 13, textAlign: 'center' },
  composerButton: { flex: 1 },
  testNotificationButton: { minHeight: 40, borderWidth: 1, borderRadius: 12, marginTop: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  testNotificationText: { fontSize: 12, fontWeight: '800' },
  list: { paddingTop: 18 },
  reminderRow: { minHeight: 64, borderWidth: 1, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  checkButton: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  reminderCopy: { flex: 1 },
  reminderTitle: { fontSize: 13, fontWeight: '800' },
  reminderTime: { fontSize: 11, marginTop: 4 },
  emptyState: { alignItems: 'center', paddingTop: 170, paddingBottom: 100 },
  emptyIllustration: { width: 270, height: 230, alignItems: 'center', justifyContent: 'flex-end', position: 'relative', marginBottom: 18 },
  cloud: { position: 'absolute', width: 170, height: 130, borderRadius: 75, top: 17, right: 29, opacity: 0.65 },
  calendar: { width: 172, height: 150, borderWidth: 5, borderRadius: 20, position: 'relative', overflow: 'visible', marginRight: 25 },
  calendarTop: { height: 44, marginTop: 29, opacity: 0.65 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11, padding: 15 },
  calendarDot: { width: 22, height: 22, borderRadius: 11 },
  calendarRing: { position: 'absolute', width: 15, height: 40, borderWidth: 4, borderRadius: 8, top: -24 },
  calendarRingLeft: { left: 28 },
  calendarRingRight: { right: 28 },
  clock: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center', position: 'absolute', right: 19, bottom: 9, borderWidth: 5, borderColor: '#00000018' },
  illustrationLine: { width: 240, height: 5, borderRadius: 3, position: 'absolute', bottom: 0 },
  emptyTitle: { fontSize: 19, fontWeight: '700', textAlign: 'center', maxWidth: 360 },
  emptyBody: { fontSize: 12, textAlign: 'center', marginTop: 7, maxWidth: 260, lineHeight: 18 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 14, marginTop: 14 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  fabRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  fab: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 8px rgba(10, 10, 10, 0.16)', elevation: 5 },
});