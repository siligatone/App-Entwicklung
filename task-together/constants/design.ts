// Design-Tokens, iOS-Stil

export const Colors = {
  primary: '#5856D6',
  primaryLight: '#7B79E0',
  primaryDark: '#3D3BB8',

  backgroundPrimary: '#F2F2F7',
  backgroundCard: '#FFFFFF',

  textPrimary: '#1C1C1E',
  textSecondary: '#3C3C43',
  textTertiary: '#8E8E93',
  textOnPrimary: '#FFFFFF',

  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',

  separator: '#C6C6C8',
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

// Apple HIG: mindestens 44pt
export const MIN_TOUCH_TARGET = 44;
