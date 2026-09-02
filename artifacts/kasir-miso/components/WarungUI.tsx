import React, { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { themeOptions } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true, footer, footerBorder = true, footerBottomInset = true, contentBottomInset = true }: { children: ReactNode; scroll?: boolean; footer?: ReactNode; footerBorder?: boolean; footerBottomInset?: boolean; contentBottomInset?: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const tabBarHeight = Platform.OS === 'web' ? 84 : 50 + insets.bottom;
  const content = (
    <View style={[ui.content, { paddingBottom: contentBottomInset ? tabBarHeight + 46 : insets.bottom + 24, paddingTop: insets.top + webTopInset + 18 }]}>
      {children}
    </View>
  );
  return (
    <View style={[ui.root, { backgroundColor: c.background }]}>
      {scroll ? <KeyboardAwareScrollViewCompat style={ui.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bottomOffset={24}>{content}</KeyboardAwareScrollViewCompat> : content}
      {footer ? <View style={[ui.fixedFooter, { paddingBottom: footerBottomInset ? tabBarHeight + 10 : insets.bottom + 10, backgroundColor: c.background, borderTopColor: c.border, borderTopWidth: footerBorder ? 1 : 0 }]}>{footer}</View> : null}
    </View>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === 'web' ? 67 : 0;
  const headerTopInset = insets.top + webTopInset + 18;
  return (
    <View style={[ui.header, { backgroundColor: c.primary, paddingTop: headerTopInset, marginTop: -headerTopInset, borderBottomColor: c.primary }]}>
      <View style={ui.headerCopy}>
        <Text style={[ui.eyebrow, { color: c.primaryForeground }]}>{eyebrow}</Text>
        <Text style={[ui.title, { color: c.primaryForeground }]}>{title}</Text>
        {subtitle ? <Text style={[ui.subtitle, { color: c.primaryForeground + 'CC' }]}>{subtitle}</Text> : null}
      </View>
      {action ?? <ThemeActions />}
    </View>
  );
}

export function ThemeActions() {
  const c = useColors();
  const { mode, themeId, selectTheme, toggleMode } = useTheme();
  const [visible, setVisible] = React.useState(false);

  return (
    <>
      <View style={ui.headerActions}>
        <IconButton icon="color-palette-outline" label="Pilih tema warna" onPress={() => setVisible(true)} />
        <IconButton
          icon={mode === 'light' ? 'moon-outline' : 'sunny-outline'}
          label={mode === 'light' ? 'Gunakan mode gelap' : 'Gunakan mode terang'}
          onPress={toggleMode}
        />
      </View>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={[ui.themeBackdrop, { backgroundColor: c.foreground + 'B8' }]}>
          <View style={[ui.themeModal, { backgroundColor: c.card }]}>
            <View style={ui.themeModalHeader}>
              <View>
                <Text style={[ui.themeKicker, { color: c.primary }]}>TAMPILAN APLIKASI</Text>
                <Text style={[ui.themeTitle, { color: c.foreground }]}>Pilih tema warna</Text>
              </View>
              <Pressable accessibilityLabel="Tutup pilihan tema" onPress={() => setVisible(false)}>
                <Ionicons name="close-circle" size={27} color={c.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView
              style={ui.themeScroll}
              contentContainerStyle={ui.themeScrollContent}
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
                      setVisible(false);
                    }}
                    style={({ pressed }) => [
                      ui.themeOption,
                      {
                        backgroundColor: selected ? c.secondary : c.card,
                        borderColor: selected ? c.primary : c.border,
                        opacity: pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <View style={[ui.themeSwatch, { backgroundColor: option.swatch }]}>
                      {selected ? <Ionicons name="checkmark" size={20} color={c.primaryForeground} /> : null}
                    </View>
                    <View style={ui.themeCopy}>
                      <Text style={[ui.themeLabel, { color: c.foreground }]}>{option.label}</Text>
                      <Text style={[ui.themeDescription, { color: c.mutedForeground }]}>{option.description}</Text>
                    </View>
                    {selected ? <Ionicons name="checkmark-circle" size={21} color={c.primary} /> : null}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={toggleMode}
                style={({ pressed }) => [
                  ui.modeButton,
                  { borderColor: c.border, backgroundColor: c.secondary, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <Ionicons name={mode === 'light' ? 'moon-outline' : 'sunny-outline'} size={19} color={c.primary} />
                <Text style={[ui.modeButtonText, { color: c.foreground }]}>
                  {mode === 'light' ? 'Gunakan mode gelap' : 'Gunakan mode terang'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function IconButton({ icon, onPress, label, tone = 'soft' }: { icon: IconName; onPress: () => void; label: string; tone?: 'soft' | 'primary' }) {
  const c = useColors();
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [ui.iconButton, { backgroundColor: tone === 'primary' ? c.primary : c.secondary, opacity: pressed ? 0.72 : 1 }]}>
      <Ionicons name={icon} size={19} color={tone === 'primary' ? c.primaryForeground : c.secondaryForeground} />
    </Pressable>
  );
}

export function Surface({ children, style, tone = 'card' }: { children: ReactNode; style?: object; tone?: 'card' | 'ink' }) {
  const c = useColors();
  return <View style={[ui.surface, { backgroundColor: tone === 'ink' ? c.foreground : c.card, borderColor: c.border }, style]}>{children}</View>;
}

export function SectionHeader({ title, meta, icon }: { title: string; meta?: string; icon?: IconName }) {
  const c = useColors();
  return (
    <View style={ui.sectionHeader}>
      <View style={ui.sectionTitleWrap}>
        {icon ? <Ionicons name={icon} size={17} color={c.primary} /> : null}
        <Text style={[ui.sectionTitle, { color: c.foreground }]}>{title}</Text>
      </View>
      {meta ? <Text style={[ui.meta, { color: c.mutedForeground }]}>{meta}</Text> : null}
    </View>
  );
}

export function Badge({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'primary' | 'muted' | 'danger' }) {
  const c = useColors();
  const palette = tone === 'primary' ? [c.primary, c.primaryForeground] : tone === 'danger' ? [c.destructive, c.destructiveForeground] : tone === 'muted' ? [c.muted, c.mutedForeground] : [c.accent, c.accentForeground];
  return <View style={[ui.badge, { backgroundColor: palette[0] }]}><Text style={[ui.badgeText, { color: palette[1] }]}>{children}</Text></View>;
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const c = useColors();
  return <Surface style={ui.empty}><View style={[ui.emptyIcon, { backgroundColor: c.secondary }]}><Ionicons name={icon} size={25} color={c.primary} /></View><Text style={[ui.emptyTitle, { color: c.foreground }]}>{title}</Text><Text style={[ui.emptyBody, { color: c.mutedForeground }]}>{body}</Text></Surface>;
}

export function PrimaryButton({ children, onPress, icon, disabled = false, testID }: { children: ReactNode; onPress: () => void; icon?: IconName; disabled?: boolean; testID?: string }) {
  const c = useColors();
  return <Pressable testID={testID} disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.primaryButton, { backgroundColor: disabled ? c.muted : c.primary, opacity: pressed ? 0.78 : 1 }]}>{icon ? <Ionicons name={icon} size={17} color={disabled ? c.mutedForeground : c.primaryForeground} /> : null}<Text style={[ui.primaryButtonText, { color: disabled ? c.mutedForeground : c.primaryForeground }]}>{children}</Text></Pressable>;
}

export const ui = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  fixedFooter: { flexShrink: 0, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1 },
  content: { paddingHorizontal: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginHorizontal: -16, marginBottom: 22, paddingHorizontal: 16, paddingBottom: 22, borderBottomWidth: 1, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  headerCopy: { flex: 1, paddingRight: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.7, textTransform: 'uppercase' },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.7, marginTop: 4 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  surface: { borderWidth: 1, borderRadius: 20, padding: 15, boxShadow: '0px 5px 12px rgba(10, 10, 10, 0.06)', elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, marginTop: 5 },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.2 },
  meta: { fontSize: 11, fontWeight: '700' },
  badge: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 27 },
  emptyIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyBody: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5, maxWidth: 250 },
  primaryButton: { minHeight: 48, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  primaryButtonText: { fontSize: 12, fontWeight: '800' },
  themeBackdrop: { flex: 1, justifyContent: 'center', padding: 16 },
  themeModal: { maxHeight: '82%', borderRadius: 24, padding: 18 },
  themeModalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  themeKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  themeTitle: { fontSize: 21, fontWeight: '800', marginTop: 4 },
  themeScroll: { flexGrow: 0 },
  themeScrollContent: { gap: 9 },
  themeOption: { minHeight: 65, borderWidth: 1, borderRadius: 15, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  themeSwatch: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  themeCopy: { flex: 1 },
  themeLabel: { fontSize: 13, fontWeight: '800' },
  themeDescription: { fontSize: 11, marginTop: 3 },
  modeButton: { minHeight: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  modeButtonText: { fontSize: 12, fontWeight: '800' },
});