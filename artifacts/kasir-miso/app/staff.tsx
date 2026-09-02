import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmptyState, PageHeader, PrimaryButton, Screen, Surface, ThemeActions } from '@/components/WarungUI';
import { attendanceStatusColors } from '@/constants/colors';
import { useColors } from '@/hooks/useColors';
import { formatRp, localDate } from '@/context/WarungContext';

const STAFF_STORAGE_KEY = 'warung-staff-v1';

type StaffTab = 'employees' | 'attendance' | 'payroll';
type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpa';
type Employee = { id: string; name: string; role: string; dailyWage: number };
type Attendance = { id: string; employeeId: string; date: string; status: AttendanceStatus };
type SalaryPayment = { id: string; employeeId: string; month: string; amount: number; paidAt: string };
type StaffStore = { employees: Employee[]; attendance: Attendance[]; payments: SalaryPayment[] };
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const emptyStore: StaffStore = { employees: [], attendance: [], payments: [] };
const attendanceOptions: Array<{ label: AttendanceStatus; icon: IconName }> = [
  { label: 'Hadir', icon: 'checkmark-circle-outline' },
  { label: 'Izin', icon: 'document-text-outline' },
  { label: 'Sakit', icon: 'medkit-outline' },
  { label: 'Alpa', icon: 'close-circle-outline' },
];
const weekdayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function AttendanceCalendar({
  month,
  monthLabel,
  selectedDate,
  attendanceByDate,
  onSelectDate,
}: {
  month: string;
  monthLabel: string;
  selectedDate: string;
  attendanceByDate: Record<string, AttendanceStatus>;
  onSelectDate: (date: string) => void;
}) {
  const c = useColors();
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const firstDayOffset = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7;
  const calendarCells = Array.from({ length: firstDayOffset + daysInMonth }, (_, index) => {
    if (index < firstDayOffset) return null;
    const day = index - firstDayOffset + 1;
    return `${month}-${String(day).padStart(2, '0')}`;
  });

  return (
    <Surface style={s.calendarCard}>
      <View style={s.calendarHeader}>
        <View>
          <Text style={[s.calendarKicker, { color: c.primary }]}>KALENDER ABSENSI</Text>
          <Text style={[s.calendarTitle, { color: c.foreground }]}>{monthLabel}</Text>
        </View>
        <Ionicons name="calendar-outline" size={22} color={c.primary} />
      </View>
      <View style={s.weekdayRow}>
        {weekdayLabels.map((label) => (
          <Text key={label} style={[s.weekdayLabel, { color: c.mutedForeground }]}>{label}</Text>
        ))}
      </View>
      <View style={s.calendarGrid}>
        {calendarCells.map((date, index) => {
          if (!date) return <View key={`empty-${index}`} style={s.calendarDayWrap} />;
          const day = Number(date.slice(-2));
          const attendanceStatus = attendanceByDate[date];
          const tone = attendanceStatus ? attendanceStatusColors[attendanceStatus] : null;
          const selected = date === selectedDate;
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={`${day} ${monthLabel}${attendanceStatus ? `, ${attendanceStatus}` : ''}`}
              onPress={() => onSelectDate(date)}
              style={({ pressed }) => [s.calendarDayWrap, { opacity: pressed ? 0.62 : 1 }]}
            >
              <View
                style={[
                  s.calendarDay,
                  {
                    backgroundColor: tone?.background ?? c.muted,
                    borderColor: selected ? c.primary : tone?.border ?? c.border,
                    borderWidth: selected ? 2 : 1,
                  },
                ]}
              >
                <Text style={[s.calendarDayText, { color: tone?.foreground ?? c.foreground }]}>{day}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={[s.calendarLegend, { borderTopColor: c.border }]}>
        {attendanceOptions.map((option) => {
          const tone = attendanceStatusColors[option.label];
          return (
            <View key={option.label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: tone.background, borderColor: tone.border }]} />
              <Text style={[s.legendText, { color: c.mutedForeground }]}>{option.label}</Text>
            </View>
          );
        })}
      </View>
    </Surface>
  );
}

function StaffTabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [s.tabButton, { opacity: pressed ? 0.62 : 1 }]}
    >
      <Text style={[s.tabText, { color: active ? c.primary : c.mutedForeground }]}>{label}</Text>
      {active ? <View style={[s.tabIndicator, { backgroundColor: c.primary }]} /> : null}
    </Pressable>
  );
}

function AttendanceButton({
  status,
  selected,
  onPress,
}: {
  status: { label: AttendanceStatus; icon: IconName };
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tandai ${status.label}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.attendanceButton,
        {
          backgroundColor: selected ? c.primary : c.muted,
          borderColor: selected ? c.primary : c.border,
          opacity: pressed ? 0.62 : 1,
        },
      ]}
    >
      <Ionicons name={status.icon} size={14} color={selected ? c.primaryForeground : c.mutedForeground} />
      <Text style={[s.attendanceButtonText, { color: selected ? c.primaryForeground : c.mutedForeground }]}>
        {status.label}
      </Text>
    </Pressable>
  );
}

export default function StaffScreen() {
  const c = useColors();
  const router = useRouter();
  const [store, setStore] = useState<StaffStore>(emptyStore);
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<StaffTab>('employees');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(localDate());
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [employeeRole, setEmployeeRole] = useState('');
  const [employeeSalary, setEmployeeSalary] = useState('');
  const [status, setStatus] = useState('');

  const today = localDate();
  const currentMonth = today.slice(0, 7);
  const monthLabel = new Date(`${currentMonth}-01T00:00:00`).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STAFF_STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        try {
          const saved = JSON.parse(raw) as Partial<StaffStore>;
          setStore({
            employees: Array.isArray(saved.employees)
              ? saved.employees.map((employee) => {
                  const legacyEmployee = employee as Employee & { salary?: number };
                  return {
                    id: legacyEmployee.id,
                    name: legacyEmployee.name,
                    role: legacyEmployee.role,
                    dailyWage: Number(legacyEmployee.dailyWage ?? (legacyEmployee.salary ? Math.round(legacyEmployee.salary / 30) : 0)),
                  };
                })
              : [],
            attendance: Array.isArray(saved.attendance) ? saved.attendance : [],
            payments: Array.isArray(saved.payments) ? saved.payments : [],
          });
        } catch {
          setStatus('Data staf belum dapat dibaca.');
        }
      })
      .catch(() => {
        if (mounted) setStatus('Data staf belum dapat dimuat.');
      })
      .finally(() => {
        if (mounted) setHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(store));
  }, [hydrated, store]);

  const presentToday = useMemo(
    () => store.employees.filter((employee) => store.attendance.some((item) => item.employeeId === employee.id && item.date === today && item.status === 'Hadir')).length,
    [store.attendance, store.employees, today],
  );
  const paidThisMonth = useMemo(
    () => store.payments.filter((payment) => payment.month === currentMonth).length,
    [currentMonth, store.payments],
  );
  const presentDaysByEmployee = useMemo(() => {
    const days: Record<string, number> = {};
    store.attendance.forEach((item) => {
      if (item.date.startsWith(currentMonth) && item.status === 'Hadir') {
        days[item.employeeId] = (days[item.employeeId] ?? 0) + 1;
      }
    });
    return days;
  }, [currentMonth, store.attendance]);
  const selectedEmployee = store.employees.find((employee) => employee.id === selectedEmployeeId) ?? store.employees[0];
  const selectedEmployeeAttendance = useMemo(() => {
    if (!selectedEmployee) return {};
    return store.attendance.reduce<Record<string, AttendanceStatus>>((result, item) => {
      if (item.employeeId === selectedEmployee.id && item.date.startsWith(currentMonth)) {
        result[item.date] = item.status;
      }
      return result;
    }, {});
  }, [currentMonth, selectedEmployee?.id, store.attendance]);

  const resetEmployeeForm = () => {
    setEmployeeName('');
    setEmployeeRole('');
    setEmployeeSalary('');
    setEmployeeModalVisible(false);
  };

  const saveEmployee = () => {
    const dailyWage = Number(employeeSalary.replace(/\D/g, ''));
    if (!employeeName.trim() || !employeeRole.trim() || !Number.isFinite(dailyWage) || dailyWage <= 0) {
      Alert.alert('Data karyawan belum lengkap', 'Isi nama, jabatan, dan upah harian dengan benar.');
      return;
    }
    const newEmployee: Employee = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: employeeName.trim(),
      role: employeeRole.trim(),
      dailyWage,
    };
    setStore((current) => ({ ...current, employees: [...current.employees, newEmployee] }));
    resetEmployeeForm();
    setStatus(`${newEmployee.name} berhasil ditambahkan.`);
  };

  const deleteEmployee = (employee: Employee) => {
    Alert.alert('Hapus karyawan?', `${employee.name} dan catatan terkait akan dihapus dari perangkat.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          setStore((current) => ({
            employees: current.employees.filter((item) => item.id !== employee.id),
            attendance: current.attendance.filter((item) => item.employeeId !== employee.id),
            payments: current.payments.filter((item) => item.employeeId !== employee.id),
          }));
          setStatus(`${employee.name} sudah dihapus.`);
        },
      },
    ]);
  };

  const setAttendance = (employeeId: string, nextStatus: AttendanceStatus, date = selectedDate) => {
    setStore((current) => {
      const exists = current.attendance.some((item) => item.employeeId === employeeId && item.date === date);
      const nextAttendance = exists
        ? current.attendance.map((item) => item.employeeId === employeeId && item.date === date ? { ...item, status: nextStatus } : item)
        : [...current.attendance, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, employeeId, date, status: nextStatus }];
      return { ...current, attendance: nextAttendance };
    });
    setStatus(`Absensi ${date} berhasil diperbarui.`);
  };

  const paySalary = (employee: Employee) => {
    const presentDays = presentDaysByEmployee[employee.id] ?? 0;
    const monthlyAmount = employee.dailyWage * presentDays;
    if (store.payments.some((payment) => payment.employeeId === employee.id && payment.month === currentMonth)) {
      setStatus(`Gaji ${employee.name} bulan ini sudah ditandai dibayar.`);
      return;
    }
    if (presentDays === 0) {
      setStatus(`${employee.name} belum memiliki absensi Hadir pada bulan ini.`);
      return;
    }
    Alert.alert(
      'Tandai gaji sudah dibayar?',
      `${employee.name} · ${presentDays} hari × ${formatRp(employee.dailyWage)} = ${formatRp(monthlyAmount)} untuk ${monthLabel}.`,
      [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Sudah dibayar',
        onPress: () => {
          setStore((current) => ({
            ...current,
            payments: [
              ...current.payments,
              { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, employeeId: employee.id, month: currentMonth, amount: monthlyAmount, paidAt: new Date().toISOString() },
            ],
          }));
          setStatus(`Gaji ${employee.name} berhasil dicatat.`);
        },
      },
      ],
    );
  };

  const formatSelectedDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen contentBottomInset={false}>
      <PageHeader
        eyebrow="Manajemen warung"
        title="Kelola staf"
        subtitle="Atur karyawan, absensi, dan pembayaran gaji dalam satu tempat."
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

      <View style={s.summaryGrid}>
        <Surface style={s.summaryCard}>
          <View style={[s.summaryIcon, { backgroundColor: c.secondary }]}>
            <Ionicons name="people-outline" size={18} color={c.primary} />
          </View>
          <Text style={[s.summaryNumber, { color: c.foreground }]}>{store.employees.length}</Text>
          <Text style={[s.summaryLabel, { color: c.mutedForeground }]}>Karyawan</Text>
        </Surface>
        <Surface style={s.summaryCard}>
          <View style={[s.summaryIcon, { backgroundColor: c.secondary }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={c.primary} />
          </View>
          <Text style={[s.summaryNumber, { color: c.foreground }]}>{presentToday}</Text>
          <Text style={[s.summaryLabel, { color: c.mutedForeground }]}>Hadir hari ini</Text>
        </Surface>
        <Surface style={s.summaryCard}>
          <View style={[s.summaryIcon, { backgroundColor: c.secondary }]}>
            <Ionicons name="wallet-outline" size={18} color={c.primary} />
          </View>
          <Text style={[s.summaryNumber, { color: c.foreground }]}>{paidThisMonth}</Text>
          <Text style={[s.summaryLabel, { color: c.mutedForeground }]}>Gaji dibayar</Text>
        </Surface>
      </View>

      <View style={[s.tabs, { borderBottomColor: c.border }]}>
        <StaffTabButton label="Karyawan" active={activeTab === 'employees'} onPress={() => setActiveTab('employees')} />
        <StaffTabButton label="Absensi" active={activeTab === 'attendance'} onPress={() => setActiveTab('attendance')} />
        <StaffTabButton label="Pembayaran gaji" active={activeTab === 'payroll'} onPress={() => setActiveTab('payroll')} />
      </View>

      {activeTab === 'employees' ? (
        <>
          <View style={s.sectionHeader}>
            <View>
              <Text style={[s.sectionKicker, { color: c.primary }]}>DATA KARYAWAN</Text>
              <Text style={[s.sectionTitle, { color: c.foreground }]}>Daftar karyawan</Text>
            </View>
            <Pressable
              testID="add-employee-button"
              accessibilityRole="button"
              accessibilityLabel="Tambah karyawan"
              onPress={() => setEmployeeModalVisible(true)}
              style={({ pressed }) => [s.addButton, { backgroundColor: c.primary, opacity: pressed ? 0.72 : 1 }]}
            >
              <Ionicons name="add" size={19} color={c.primaryForeground} />
              <Text style={[s.addButtonText, { color: c.primaryForeground }]}>Tambah</Text>
            </Pressable>
          </View>
          {store.employees.length ? (
            <View style={s.list}>
              {store.employees.map((employee) => (
                <Surface key={employee.id} style={s.employeeCard}>
                  <View style={[s.employeeIcon, { backgroundColor: c.secondary }]}>
                    <Ionicons name="person-outline" size={21} color={c.primary} />
                  </View>
                  <View style={s.employeeCopy}>
                    <Text style={[s.employeeName, { color: c.foreground }]}>{employee.name}</Text>
                    <Text style={[s.employeeRole, { color: c.mutedForeground }]}>{employee.role}</Text>
                    <Text style={[s.employeeSalary, { color: c.primary }]}>{formatRp(employee.dailyWage)} / hari</Text>
                  </View>
                  <Pressable
                    testID={`delete-employee-${employee.id}`}
                    accessibilityLabel={`Hapus ${employee.name}`}
                    hitSlop={10}
                    onPress={() => deleteEmployee(employee)}
                  >
                    <Ionicons name="trash-outline" size={19} color={c.destructive} />
                  </Pressable>
                </Surface>
              ))}
            </View>
          ) : (
            <EmptyState icon="people-outline" title="Belum ada karyawan" body="Tambahkan karyawan untuk mulai mencatat absensi dan gaji." />
          )}
        </>
      ) : null}

      {activeTab === 'attendance' ? (
        <>
          <Text style={[s.sectionKicker, { color: c.primary }]}>ABSENSI HARIAN</Text>
          <Text style={[s.sectionTitle, { color: c.foreground }]}>Kalender kehadiran</Text>
          <Text style={[s.sectionBody, { color: c.mutedForeground }]}>Pilih karyawan dan tanggal, lalu tandai status absensinya.</Text>
          {store.employees.length ? (
            <>
              <View style={s.employeePicker}>
              {store.employees.map((employee) => {
                  const selected = employee.id === selectedEmployee?.id;
                  return (
                    <Pressable
                      key={employee.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Pilih ${employee.name}`}
                      onPress={() => setSelectedEmployeeId(employee.id)}
                      style={({ pressed }) => [
                        s.employeeChip,
                        {
                          backgroundColor: selected ? c.primary : c.card,
                          borderColor: selected ? c.primary : c.border,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="person-outline" size={14} color={selected ? c.primaryForeground : c.primary} />
                      <Text style={[s.employeeChipText, { color: selected ? c.primaryForeground : c.foreground }]}>{employee.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedEmployee ? (
                <>
                  <AttendanceCalendar
                    month={currentMonth}
                    monthLabel={monthLabel}
                    selectedDate={selectedDate}
                    attendanceByDate={selectedEmployeeAttendance}
                    onSelectDate={setSelectedDate}
                  />
                  <Surface style={s.selectedDateCard}>
                    <View style={s.selectedDateHeader}>
                      <View style={s.employeeCopy}>
                        <Text style={[s.sectionKicker, { color: c.primary }]}>STATUS TANGGAL TERPILIH</Text>
                        <Text style={[s.selectedDateTitle, { color: c.foreground }]}>{formatSelectedDate(selectedDate)}</Text>
                      </View>
                      <Text style={[s.selectedDateStatus, { color: c.mutedForeground }]}>
                        {selectedEmployeeAttendance[selectedDate] ?? 'Belum diabsen'}
                      </Text>
                    </View>
                    <View style={s.attendanceOptions}>
                      {attendanceOptions.map((option) => (
                        <AttendanceButton
                          key={option.label}
                          status={option}
                          selected={selectedEmployeeAttendance[selectedDate] === option.label}
                          onPress={() => setAttendance(selectedEmployee.id, option.label, selectedDate)}
                        />
                      ))}
                    </View>
                  </Surface>
                </>
              ) : null}
            </>
          ) : (
            <EmptyState icon="calendar-outline" title="Belum ada karyawan" body="Tambahkan karyawan dari tab Karyawan terlebih dahulu." />
          )}
        </>
      ) : null}

      {activeTab === 'payroll' ? (
        <>
          <Text style={[s.sectionKicker, { color: c.primary }]}>PEMBAYARAN GAJI</Text>
          <Text style={[s.sectionTitle, { color: c.foreground }]}>Gaji {monthLabel}</Text>
           <Text style={[s.sectionBody, { color: c.mutedForeground }]}>Gaji dihitung dari jumlah hari Hadir dikali upah harian.</Text>
          {store.employees.length ? (
            <View style={s.list}>
              {store.employees.map((employee) => {
                const isPaid = store.payments.some((payment) => payment.employeeId === employee.id && payment.month === currentMonth);
                const presentDays = presentDaysByEmployee[employee.id] ?? 0;
                const monthlyAmount = employee.dailyWage * presentDays;
                return (
                  <Surface key={employee.id} style={s.payrollCard}>
                    <View style={[s.employeeIcon, { backgroundColor: c.secondary }]}>
                      <Ionicons name="wallet-outline" size={20} color={c.primary} />
                    </View>
                    <View style={s.employeeCopy}>
                      <Text style={[s.employeeName, { color: c.foreground }]}>{employee.name}</Text>
                      <Text style={[s.employeeRole, { color: c.mutedForeground }]}>{employee.role}</Text>
                      <Text style={[s.employeeSalary, { color: c.foreground }]}>{formatRp(monthlyAmount)} · {presentDays} hari Hadir</Text>
                      <Text style={[s.employeeRole, { color: c.mutedForeground }]}>{formatRp(employee.dailyWage)} / hari</Text>
                    </View>
                    <Pressable
                      testID={`pay-salary-${employee.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`${isPaid ? 'Gaji sudah dibayar' : 'Bayar gaji'} ${employee.name}`}
                      disabled={isPaid}
                      onPress={() => paySalary(employee)}
                      style={({ pressed }) => [
                        s.payButton,
                        { backgroundColor: isPaid ? c.muted : c.primary, opacity: pressed ? 0.72 : 1 },
                      ]}
                    >
                      <Ionicons name={isPaid ? 'checkmark' : 'cash-outline'} size={15} color={isPaid ? c.mutedForeground : c.primaryForeground} />
                      <Text style={[s.payButtonText, { color: isPaid ? c.mutedForeground : c.primaryForeground }]}>
                        {isPaid ? 'Dibayar' : 'Bayar'}
                      </Text>
                    </Pressable>
                  </Surface>
                );
              })}
            </View>
          ) : (
            <EmptyState icon="wallet-outline" title="Belum ada data gaji" body="Catat absensi Hadir untuk menghitung gaji bulanan." />
          )}
        </>
      ) : null}

      {status ? (
        <Text accessibilityLiveRegion="polite" style={[s.status, { color: c.primary }]}>
          {status}
        </Text>
      ) : null}

      <Modal
        visible={employeeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={resetEmployeeForm}
      >
        <View style={[s.modalBackdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <View style={[s.editorModal, { backgroundColor: c.card }]}>
            <View style={s.modalHeader}>
              <View style={s.modalHeaderCopy}>
                <Text style={[s.modalKicker, { color: c.primary }]}>DATA KARYAWAN</Text>
                <Text style={[s.modalTitle, { color: c.foreground }]}>Tambah karyawan</Text>
              </View>
              <Pressable accessibilityLabel="Tutup tambah karyawan" hitSlop={8} onPress={resetEmployeeForm}>
                <Ionicons name="close-circle" size={27} color={c.mutedForeground} />
              </Pressable>
            </View>
            <TextInput
              autoFocus
              value={employeeName}
              onChangeText={setEmployeeName}
              placeholder="Nama karyawan"
              placeholderTextColor={c.mutedForeground}
              style={[s.input, { color: c.foreground, backgroundColor: c.background, borderColor: c.border }]}
            />
            <TextInput
              value={employeeRole}
              onChangeText={setEmployeeRole}
              placeholder="Jabatan, contoh: Kasir"
              placeholderTextColor={c.mutedForeground}
              style={[s.input, { color: c.foreground, backgroundColor: c.background, borderColor: c.border }]}
            />
            <TextInput
              value={employeeSalary}
              onChangeText={setEmployeeSalary}
              placeholder="Upah per hari, contoh: 100000"
              placeholderTextColor={c.mutedForeground}
              keyboardType="numeric"
              style={[s.input, { color: c.foreground, backgroundColor: c.background, borderColor: c.border }]}
            />
            <PrimaryButton testID="save-employee-button" onPress={saveEmployee} icon="checkmark-circle-outline">
              Simpan karyawan
            </PrimaryButton>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  summaryGrid: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  summaryCard: { flex: 1, padding: 11, minHeight: 108 },
  summaryIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  summaryNumber: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  tabs: { height: 49, flexDirection: 'row', borderBottomWidth: 1, marginBottom: 19 },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  tabText: { fontSize: 11, fontWeight: '800', textAlign: 'center' },
  tabIndicator: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  sectionBody: { fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 12 },
  addButton: { minHeight: 39, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  addButtonText: { fontSize: 11, fontWeight: '800' },
  list: { gap: 9 },
  employeeCard: { minHeight: 84, padding: 12, flexDirection: 'row', alignItems: 'center' },
  employeeIcon: { width: 41, height: 41, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  employeeCopy: { flex: 1, paddingRight: 8 },
  employeeName: { fontSize: 14, fontWeight: '800' },
  employeeRole: { fontSize: 11, marginTop: 3 },
  employeeSalary: { fontSize: 11, fontWeight: '800', marginTop: 5 },
  attendanceCard: { padding: 12 },
  attendanceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  attendanceOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  attendanceButton: { minHeight: 32, paddingHorizontal: 9, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  attendanceButtonText: { fontSize: 10, fontWeight: '800' },
  employeePicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 11 },
  employeeChip: { minHeight: 36, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  employeeChipText: { fontSize: 11, fontWeight: '800' },
  calendarCard: { padding: 14, marginBottom: 10 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  calendarKicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  calendarTitle: { fontSize: 16, fontWeight: '800', marginTop: 3 },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { width: '14.2857%', textAlign: 'center', fontSize: 10, fontWeight: '800' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayWrap: { width: '14.2857%', minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  calendarDay: { width: 33, height: 33, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  calendarDayText: { fontSize: 11, fontWeight: '800' },
  calendarLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 9, paddingTop: 10, borderTopWidth: 1 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  legendText: { fontSize: 10, fontWeight: '700' },
  selectedDateCard: { padding: 14, marginBottom: 12 },
  selectedDateHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 11 },
  selectedDateTitle: { fontSize: 15, fontWeight: '800', marginTop: 4, textTransform: 'capitalize' },
  selectedDateStatus: { fontSize: 11, fontWeight: '800', textAlign: 'right' },
  payrollCard: { minHeight: 84, padding: 12, flexDirection: 'row', alignItems: 'center' },
  payButton: { minHeight: 34, paddingHorizontal: 10, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: 4 },
  payButtonText: { fontSize: 10, fontWeight: '800' },
  status: { fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 13, marginBottom: 7 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 16 },
  editorModal: { borderRadius: 24, padding: 19 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 15 },
  modalHeaderCopy: { flex: 1, paddingRight: 12 },
  modalKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  modalTitle: { fontSize: 21, fontWeight: '800', marginTop: 4 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontSize: 13, marginBottom: 9 },
});