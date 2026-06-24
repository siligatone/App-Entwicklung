/**
 * Design-Tokens für TaskTogether.
 * iOS-inspiriertes Design-System mit ruhigen Farben und klaren Abständen.
 */

export const Colors = {
  // Primärfarbe — iOS-Systemviolett
  primary: '#5856D6',
  primaryLight: '#7B79E0',
  primaryDark: '#3D3BB8',

  // Hintergründe
  backgroundPrimary: '#F2F2F7',   // iOS-System-Grau (Haupthintergrund)
  backgroundCard: '#FFFFFF',       // Karten-Hintergrund

  // Text
  textPrimary: '#1C1C1E',         // iOS-Label-Primär
  textSecondary: '#3C3C43',       // iOS-Label-Sekundär
  textTertiary: '#8E8E93',        // iOS-Label-Tertiär (Hints, Metainfos)
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#34C759',             // iOS-Grün
  danger: '#FF3B30',              // iOS-Rot
  warning: '#FF9500',             // iOS-Orange

  // Trennlinien
  separator: '#C6C6C8',           // iOS-Separator
  separatorOpaque: '#E5E5EA',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const Typography = {
  // Größen
  sizeXS: 12,
  sizeSM: 14,
  sizeMD: 16,
  sizeLG: 18,
  sizeXL: 22,
  sizeXXL: 28,

  // Gewichte
  weightRegular: '400' as const,
  weightMedium: '500' as const,
  weightSemiBold: '600' as const,
  weightBold: '700' as const,

  // Zeilenhöhen
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};

/** Minimale Touch-Fläche laut Apple HIG */
export const MIN_TOUCH_TARGET = 44;
