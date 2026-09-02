export type ThemeId = 'ocean' | 'forest' | 'sunset' | 'violet' | 'charcoal' | 'teal' | 'indigo' | 'rose' | 'amber' | 'mint';
export type ThemeMode = 'light' | 'dark';

export type Palette = {
  text: string;
  tint: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
};

export const themeOptions: Array<{ id: ThemeId; label: string; description: string; swatch: string }> = [
  { id: 'ocean', label: 'Biru Laut', description: 'Segar dan profesional', swatch: '#1677D2' },
  { id: 'forest', label: 'Hijau Hutan', description: 'Tenang dan natural', swatch: '#16805B' },
  { id: 'sunset', label: 'Senja', description: 'Hangat dan berani', swatch: '#D95C3A' },
  { id: 'violet', label: 'Ungu', description: 'Modern dan kreatif', swatch: '#7651C8' },
  { id: 'charcoal', label: 'Arang', description: 'Kontras dan elegan', swatch: '#343A46' },
  { id: 'teal', label: 'Teal', description: 'Segar dan seimbang', swatch: '#0F8B8D' },
  { id: 'indigo', label: 'Indigo', description: 'Tenang dan terpercaya', swatch: '#4F46B5' },
  { id: 'rose', label: 'Mawar', description: 'Lembut dan berkarakter', swatch: '#C94B72' },
  { id: 'amber', label: 'Amber', description: 'Cerah dan optimistis', swatch: '#C27A12' },
  { id: 'mint', label: 'Mint', description: 'Ringan dan menyegarkan', swatch: '#3A9D78' },
];

const colors: Record<ThemeId, { light: Palette; dark: Palette }> = {
  ocean: {
    light: {
      text: '#122033', tint: '#1677D2', background: '#EEF6FF', foreground: '#122033',
      card: '#FFFFFF', cardForeground: '#122033', primary: '#1677D2', primaryForeground: '#FFFFFF',
      secondary: '#DDEEFF', secondaryForeground: '#164A7A', muted: '#E4F0FC', mutedForeground: '#5C7187',
      accent: '#4EB6E9', accentForeground: '#083552', destructive: '#C83D4A', destructiveForeground: '#FFFFFF',
      border: '#C8DDF1', input: '#B6CFE7',
    },
    dark: {
      text: '#EAF5FF', tint: '#5CB8F0', background: '#0D1B2A', foreground: '#EAF5FF',
      card: '#152A3E', cardForeground: '#EAF5FF', primary: '#5CB8F0', primaryForeground: '#082039',
      secondary: '#1D3C59', secondaryForeground: '#DDF1FF', muted: '#1A3045', mutedForeground: '#A7C0D5',
      accent: '#6CC7E9', accentForeground: '#082B3A', destructive: '#F2767E', destructiveForeground: '#2B1115',
      border: '#2B4B67', input: '#416682',
    },
  },
  forest: {
    light: {
      text: '#142B25', tint: '#16805B', background: '#EFF9F4', foreground: '#142B25',
      card: '#FFFFFF', cardForeground: '#142B25', primary: '#16805B', primaryForeground: '#FFFFFF',
      secondary: '#DDF3E8', secondaryForeground: '#15563F', muted: '#E6F4ED', mutedForeground: '#647B71',
      accent: '#A6D65D', accentForeground: '#274313', destructive: '#C94343', destructiveForeground: '#FFFFFF',
      border: '#C8E2D4', input: '#B4D5C5',
    },
    dark: {
      text: '#EDFFF5', tint: '#54C994', background: '#0D211A', foreground: '#EDFFF5',
      card: '#16382B', cardForeground: '#EDFFF5', primary: '#54C994', primaryForeground: '#092519',
      secondary: '#20513D', secondaryForeground: '#E1FFF0', muted: '#1A3B2D', mutedForeground: '#A8C9B8',
      accent: '#B5DD6E', accentForeground: '#233C0E', destructive: '#F27D74', destructiveForeground: '#2C1110',
      border: '#2C604A', input: '#42765D',
    },
  },
  sunset: {
    light: {
      text: '#332019', tint: '#D95C3A', background: '#FFF5EC', foreground: '#332019',
      card: '#FFFCF8', cardForeground: '#332019', primary: '#D95C3A', primaryForeground: '#FFFFFF',
      secondary: '#FBE2D2', secondaryForeground: '#713525', muted: '#F7E8DC', mutedForeground: '#8A7267',
      accent: '#F2B844', accentForeground: '#55350B', destructive: '#B83245', destructiveForeground: '#FFFFFF',
      border: '#EBD1C0', input: '#DDBBA5',
    },
    dark: {
      text: '#FFF3E8', tint: '#F28A61', background: '#281A17', foreground: '#FFF3E8',
      card: '#3A2520', cardForeground: '#FFF3E8', primary: '#F28A61', primaryForeground: '#321610',
      secondary: '#553329', secondaryForeground: '#FFE9DA', muted: '#422A24', mutedForeground: '#D0AEA0',
      accent: '#F4C85A', accentForeground: '#4D3105', destructive: '#F07A78', destructiveForeground: '#321114',
      border: '#654339', input: '#7D5548',
    },
  },
  violet: {
    light: {
      text: '#211B35', tint: '#7651C8', background: '#F5F2FF', foreground: '#211B35',
      card: '#FFFFFF', cardForeground: '#211B35', primary: '#7651C8', primaryForeground: '#FFFFFF',
      secondary: '#EAE3FF', secondaryForeground: '#513596', muted: '#EEEAF9', mutedForeground: '#756B8D',
      accent: '#E6A9D5', accentForeground: '#532D4C', destructive: '#C9405B', destructiveForeground: '#FFFFFF',
      border: '#D9CFF2', input: '#C3B5E1',
    },
    dark: {
      text: '#F6F1FF', tint: '#B39AF2', background: '#171226', foreground: '#F6F1FF',
      card: '#28203D', cardForeground: '#F6F1FF', primary: '#B39AF2', primaryForeground: '#21143E',
      secondary: '#3C2F5B', secondaryForeground: '#EFE7FF', muted: '#302746', mutedForeground: '#BBAFD0',
      accent: '#E9A9D5', accentForeground: '#4A2342', destructive: '#F27A8D', destructiveForeground: '#341018',
      border: '#4C3D6A', input: '#645184',
    },
  },
  charcoal: {
    light: {
      text: '#20242B', tint: '#343A46', background: '#F3F5F7', foreground: '#20242B',
      card: '#FFFFFF', cardForeground: '#20242B', primary: '#343A46', primaryForeground: '#FFFFFF',
      secondary: '#E5E9EE', secondaryForeground: '#394452', muted: '#E9EDF1', mutedForeground: '#6F7A86',
      accent: '#D4A84B', accentForeground: '#49350E', destructive: '#C33D4B', destructiveForeground: '#FFFFFF',
      border: '#D3DAE2', input: '#BAC4CF',
    },
    dark: {
      text: '#F1F4F7', tint: '#AAB7C5', background: '#15191E', foreground: '#F1F4F7',
      card: '#232A32', cardForeground: '#F1F4F7', primary: '#AAB7C5', primaryForeground: '#1B222A',
      secondary: '#343E49', secondaryForeground: '#EDF2F7', muted: '#2A323B', mutedForeground: '#AAB5C0',
      accent: '#E0B85B', accentForeground: '#44320A', destructive: '#F1747C', destructiveForeground: '#351115',
      border: '#46515D', input: '#5D6977',
    },
  },
  teal: {
    light: {
      text: '#102B2B', tint: '#0F8B8D', background: '#EFFBFB', foreground: '#102B2B',
      card: '#FFFFFF', cardForeground: '#102B2B', primary: '#0F8B8D', primaryForeground: '#FFFFFF',
      secondary: '#D9F1F0', secondaryForeground: '#0D5D60', muted: '#E5F5F4', mutedForeground: '#648080',
      accent: '#57C7B8', accentForeground: '#073D3C', destructive: '#C8434D', destructiveForeground: '#FFFFFF',
      border: '#C6E2E1', input: '#B2D4D3',
    },
    dark: {
      text: '#E8FFFF', tint: '#5ED2C9', background: '#0B2223', foreground: '#E8FFFF',
      card: '#153B3C', cardForeground: '#E8FFFF', primary: '#5ED2C9', primaryForeground: '#092B2C',
      secondary: '#205557', secondaryForeground: '#DDFBFA', muted: '#1A4142', mutedForeground: '#A4C9C7',
      accent: '#75D8C1', accentForeground: '#0B3B35', destructive: '#F47B7B', destructiveForeground: '#351113',
      border: '#2E6667', input: '#467D7D',
    },
  },
  indigo: {
    light: {
      text: '#1D2340', tint: '#4F46B5', background: '#F2F3FF', foreground: '#1D2340',
      card: '#FFFFFF', cardForeground: '#1D2340', primary: '#4F46B5', primaryForeground: '#FFFFFF',
      secondary: '#E2E3FF', secondaryForeground: '#37318A', muted: '#EAEAFF', mutedForeground: '#727694',
      accent: '#8294E8', accentForeground: '#1E2C65', destructive: '#C94058', destructiveForeground: '#FFFFFF',
      border: '#D2D4F1', input: '#BCC0E2',
    },
    dark: {
      text: '#F1F2FF', tint: '#A4AEFF', background: '#15172D', foreground: '#F1F2FF',
      card: '#272A4A', cardForeground: '#F1F2FF', primary: '#A4AEFF', primaryForeground: '#20234B',
      secondary: '#3A3E6B', secondaryForeground: '#E9EAFF', muted: '#303458', mutedForeground: '#B7BBDD',
      accent: '#9CA9F4', accentForeground: '#202B61', destructive: '#F47B8C', destructiveForeground: '#35101B',
      border: '#4A4E7A', input: '#626795',
    },
  },
  rose: {
    light: {
      text: '#351C28', tint: '#C94B72', background: '#FFF3F7', foreground: '#351C28',
      card: '#FFFDFE', cardForeground: '#351C28', primary: '#C94B72', primaryForeground: '#FFFFFF',
      secondary: '#F8DCE6', secondaryForeground: '#7D2F4B', muted: '#F9E8EE', mutedForeground: '#8C707B',
      accent: '#E99AAE', accentForeground: '#5C2032', destructive: '#B93445', destructiveForeground: '#FFFFFF',
      border: '#EBCBD7', input: '#DCB4C3',
    },
    dark: {
      text: '#FFF0F5', tint: '#F28AAA', background: '#2A1720', foreground: '#FFF0F5',
      card: '#432530', cardForeground: '#FFF0F5', primary: '#F28AAA', primaryForeground: '#421827',
      secondary: '#613544', secondaryForeground: '#FFE5EE', muted: '#4C2B38', mutedForeground: '#D1AAB8',
      accent: '#F4B1BC', accentForeground: '#55212C', destructive: '#F37A81', destructiveForeground: '#3B1015',
      border: '#704252', input: '#895666',
    },
  },
  amber: {
    light: {
      text: '#332617', tint: '#C27A12', background: '#FFF9ED', foreground: '#332617',
      card: '#FFFDFC', cardForeground: '#332617', primary: '#C27A12', primaryForeground: '#FFFFFF',
      secondary: '#F8E8C7', secondaryForeground: '#70470C', muted: '#F9F0DD', mutedForeground: '#8B7960',
      accent: '#F0B84D', accentForeground: '#553607', destructive: '#BE3C45', destructiveForeground: '#FFFFFF',
      border: '#EBD8AE', input: '#DCC493',
    },
    dark: {
      text: '#FFF7E8', tint: '#F0B84D', background: '#281E11', foreground: '#FFF7E8',
      card: '#44331A', cardForeground: '#FFF7E8', primary: '#F0B84D', primaryForeground: '#3D2807',
      secondary: '#654A22', secondaryForeground: '#FFF0CE', muted: '#503B1D', mutedForeground: '#D2B987',
      accent: '#F5CA69', accentForeground: '#543706', destructive: '#F27679', destructiveForeground: '#351113',
      border: '#795D2B', input: '#94733A',
    },
  },
  mint: {
    light: {
      text: '#173029', tint: '#3A9D78', background: '#F0FBF6', foreground: '#173029',
      card: '#FFFFFF', cardForeground: '#173029', primary: '#3A9D78', primaryForeground: '#FFFFFF',
      secondary: '#D9F1E5', secondaryForeground: '#21634B', muted: '#E5F5EC', mutedForeground: '#668176',
      accent: '#8BCF9E', accentForeground: '#1F4F2B', destructive: '#C8444C', destructiveForeground: '#FFFFFF',
      border: '#C5E2D1', input: '#B1D5C0',
    },
    dark: {
      text: '#ECFFF5', tint: '#73D5A8', background: '#0F241B', foreground: '#ECFFF5',
      card: '#1B3B2D', cardForeground: '#ECFFF5', primary: '#73D5A8', primaryForeground: '#0C3021',
      secondary: '#285440', secondaryForeground: '#E2FFF0', muted: '#214634', mutedForeground: '#A9CCB8',
      accent: '#9CDBA5', accentForeground: '#214A28', destructive: '#F27979', destructiveForeground: '#321014',
      border: '#376950', input: '#4D8063',
    },
  },
};

export const defaultTheme: ThemeId = 'ocean';
export const radius = 16;

export const attendanceStatusColors = {
  Hadir: { background: '#DCF5E8', foreground: '#1B7A4B', border: '#B2E7C8' },
  Izin: { background: '#FFF4D8', foreground: '#9A6500', border: '#F4D58A' },
  Sakit: { background: '#E2ECFF', foreground: '#3E63A7', border: '#C5D7FA' },
  Alpa: { background: '#FCE0E3', foreground: '#B63847', border: '#F2B9C0' },
} as const;

export default colors;