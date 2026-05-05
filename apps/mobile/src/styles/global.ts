import { StyleSheet, Platform, StatusBar } from 'react-native';
import { COLORS, DARK_COLORS, DESIGN } from '../constants/theme';

export const createStyles = (isDark: boolean) => {
  const theme = isDark ? DARK_COLORS : COLORS;
  const shadowColor = isDark ? '#000000' : '#0F172A';

  const cardShadow = {
    shadowColor,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: isDark ? 0.26 : 0.07,
    shadowRadius: 20,
    elevation: 3
  };

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.slate,
      paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 4 : 0
    },
    container: {
      flex: 1,
      backgroundColor: theme.slate
    },
    mainScroll: {
      flex: 1,
      paddingHorizontal: DESIGN.spacing.md
    },

    // LOGIN
    loginContainer: {
      flex: 1,
      backgroundColor: theme.slate
    },
    loginHeaderDecorator: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 318,
      backgroundColor: theme.blueDark,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32
    },
    loginFooterDecorator: {
      position: 'absolute',
      bottom: 0,
      left: 24,
      right: 24,
      height: 1,
      backgroundColor: theme.border
    },
    loginHeader: {
      alignItems: 'center',
      paddingHorizontal: 12,
      marginBottom: 22
    },
    loginLogoCard: {
      width: 220,
      height: 88,
      borderRadius: 0,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10
    },
    loginLogo: {
      width: 196,
      height: 68
    },
    loginEyebrow: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.blue,
      letterSpacing: 1.2,
      marginBottom: 8,
      textTransform: 'uppercase'
    },
    loginWelcomeTitle: {
      fontSize: 28,
      fontWeight: '900',
      color: theme.blueDark,
      letterSpacing: 0
    },
    loginWelcomeSubtitle: {
      fontSize: 13,
      color: theme.subtext,
      textAlign: 'center',
      marginTop: 6,
      paddingHorizontal: 12,
      fontWeight: '600',
      lineHeight: 18
    },
    loginCard: {
      width: '100%',
      backgroundColor: theme.white,
      borderRadius: DESIGN.radius.lg,
      paddingHorizontal: 20,
      paddingVertical: 22,
      borderWidth: 1,
      borderColor: theme.border,
      ...cardShadow
    },
    loginCardHeader: {
      marginBottom: 18
    },
    loginCardTitle: {
      fontSize: 24,
      fontWeight: '900',
      color: theme.text,
      letterSpacing: 0
    },
    loginCardSubtitle: {
      fontSize: 12,
      color: theme.subtext,
      fontWeight: '600',
      lineHeight: 17,
      marginTop: 4
    },
    inputGroup: {
      marginBottom: 16,
      width: '100%'
    },
    fieldLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.subtext,
      letterSpacing: 0.8,
      marginBottom: 7,
      marginLeft: 2,
      textTransform: 'uppercase'
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.input,
      borderRadius: DESIGN.radius.md,
      paddingHorizontal: 12,
      minHeight: 54,
      borderWidth: 1,
      borderColor: theme.border
    },
    loginIconBox: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8
    },
    inputIcon: {
      marginRight: 10,
      width: 20,
      textAlign: 'center'
    },
    loginInput: {
      flex: 1,
      height: 52,
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      backgroundColor: 'transparent'
    },
    loginBtn: {
      backgroundColor: theme.orange,
      minHeight: 56,
      borderRadius: DESIGN.radius.md,
      marginTop: 8,
      shadowColor: theme.orange,
      shadowOpacity: isDark ? 0.24 : 0.2,
      shadowRadius: 12,
      elevation: 4,
      justifyContent: 'center',
      alignItems: 'center'
    },
    loginBtnContent: {
      flexDirection: 'row',
      alignItems: 'center'
    },
    loginBtnText: {
      color: theme.whiteText,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0.4,
      marginRight: 10
    },
    loginDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 18,
      paddingHorizontal: 8
    },
    loginDividerText: {
      marginHorizontal: 14,
      fontSize: 10,
      fontWeight: '900',
      color: theme.subtext,
      letterSpacing: 0.8
    },
    loginSecurityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 16,
      paddingHorizontal: 6
    },
    forgotBtn: {
      marginTop: 18,
      alignItems: 'center'
    },
    forgotText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.subtext
    },
    loginFooterText: {
      fontSize: 11,
      color: theme.subtext,
      fontWeight: '700'
    },
    attachmentBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.input,
      padding: 12,
      borderRadius: DESIGN.radius.md,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border
    },
    attachmentBadgeText: {
      fontSize: 13,
      color: theme.text,
      fontWeight: '600',
      flex: 1,
      marginRight: 10
    },

    // ATTACHMENTS
    attachmentSection: {
      marginBottom: 22,
      marginTop: 8
    },
    attachmentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12
    },
    attachmentCount: {
      backgroundColor: theme.blueDark,
      width: 22,
      height: 22,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8
    },
    attachmentCountText: {
      color: theme.whiteText,
      fontSize: 10,
      fontWeight: '900'
    },
    uploadZone: {
      width: '100%',
      minHeight: 118,
      backgroundColor: theme.surfaceAlt,
      borderRadius: DESIGN.radius.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16
    },
    uploadCircle: {
      width: 44,
      height: 44,
      borderRadius: DESIGN.radius.md,
      backgroundColor: theme.orangeSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10
    },
    uploadTitle: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.blueDark
    },
    uploadSubtitle: {
      fontSize: 11,
      color: theme.subtext,
      marginTop: 2
    },
    attachmentsList: {
      marginBottom: 8
    },
    attachmentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.white,
      borderRadius: DESIGN.radius.md,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border
    },
    fileIconBox: {
      width: 38,
      height: 38,
      borderRadius: 9,
      backgroundColor: theme.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12
    },
    fileInfo: {
      flex: 1
    },
    fileName: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 2
    },
    fileType: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.blue
    },
    attachmentTypeWrapper: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: DESIGN.radius.sm,
      backgroundColor: theme.surfaceAlt,
      overflow: 'hidden'
    },
    attachmentTypePicker: {
      height: 40,
      color: theme.text
    },
    removeBtn: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: theme.roseSoft,
      alignItems: 'center',
      justifyContent: 'center'
    },

    // HEADER
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 16,
      padding: 16,
      backgroundColor: theme.white,
      borderRadius: DESIGN.radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      ...cardShadow
    },
    welcomeText: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.text,
      letterSpacing: 0
    },
    headerSubtitle: {
      fontSize: 12,
      color: theme.subtext,
      fontWeight: '600',
      marginTop: 4
    },
    profileBtn: {
      width: 44,
      height: 44,
      borderRadius: DESIGN.radius.md,
      backgroundColor: theme.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border
    },
    profileInitial: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.orange
    },

    // KPI
    kpiGrid: {
      marginBottom: 22
    },
    kpiGridLandscape: {
      flexDirection: 'row'
    },
    mainKpiCard: {
      backgroundColor: theme.white,
      borderRadius: DESIGN.radius.lg,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...cardShadow
    },
    kpiLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.subtext,
      letterSpacing: 0.9,
      marginBottom: 8,
      textTransform: 'uppercase'
    },
    progressContainer: {
      marginTop: 4
    },
    progressTextRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 12
    },
    kpiValue: {
      fontSize: 34,
      fontWeight: '900',
      color: theme.blueDark,
      letterSpacing: 0
    },
    kpiSubValue: {
      fontSize: 15,
      fontWeight: '900',
      color: theme.orange,
      marginBottom: 4
    },
    progressBarBg: {
      width: '100%',
      height: 9,
      backgroundColor: theme.track,
      borderRadius: 5,
      overflow: 'hidden',
      marginBottom: 8
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.orange,
      borderRadius: 5
    },
    metaLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.subtext
    },

    commissionCard: {
      backgroundColor: theme.blueDark,
      borderRadius: DESIGN.radius.lg,
      padding: 18,
      shadowColor: theme.blueDark,
      shadowOpacity: isDark ? 0.28 : 0.18,
      shadowRadius: 16,
      elevation: 4
    },
    commissionValue: {
      fontSize: 27,
      fontWeight: '900',
      color: theme.whiteText,
      marginVertical: 4
    },
    commissionNote: {
      fontSize: 11,
      color: 'rgba(255,255,255,0.72)',
      fontWeight: '700'
    },

    // SECTIONS
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.subtext,
      letterSpacing: 0.9
    },
    seeAllText: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.orange,
      marginRight: 3
    },

    quickList: {
      backgroundColor: theme.white,
      borderRadius: DESIGN.radius.lg,
      padding: 6,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: theme.border,
      ...cardShadow
    },
    saleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 13,
      borderBottomWidth: 1,
      borderBottomColor: theme.divider
    },
    statusIndicator: {
      width: 4,
      height: 30,
      borderRadius: 2,
      marginRight: 13
    },
    saleName: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 2
    },
    saleMeta: {
      fontSize: 12,
      color: theme.subtext,
      fontWeight: '600'
    },

    // LIST
    fullSaleCard: {
      backgroundColor: theme.white,
      borderRadius: DESIGN.radius.lg,
      padding: 15,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...cardShadow
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    },
    cardDni: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.subtext
    },
    pill: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 8
    },
    pillText: {
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase'
    },
    cardName: {
      fontSize: 17,
      fontWeight: '900',
      color: theme.text,
      marginBottom: 12
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    cardAmount: {
      fontSize: 16,
      fontWeight: '900',
      color: theme.text
    },
    cardDate: {
      fontSize: 12,
      color: theme.subtext,
      fontWeight: '700'
    },
    tracePreview: {
      marginTop: 13,
      padding: 11,
      backgroundColor: theme.surfaceAlt,
      borderRadius: DESIGN.radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'flex-start'
    },
    traceIconBox: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: theme.blueSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10
    },
    traceLabel: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.blue,
      textTransform: 'uppercase',
      letterSpacing: 0.4
    },
    traceText: {
      fontSize: 11,
      color: theme.subtext,
      fontWeight: '700',
      lineHeight: 15,
      marginTop: 3
    },
    warningAlert: {
      marginTop: 13,
      padding: 10,
      backgroundColor: theme.amberSoft,
      borderRadius: DESIGN.radius.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(245,158,11,0.22)' : theme.orangeSoft
    },
    warningText: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.amber
    },

    // FORM
    formCard: {
      backgroundColor: theme.white,
      borderRadius: DESIGN.radius.lg,
      padding: 18,
      marginBottom: 92,
      borderWidth: 1,
      borderColor: theme.border,
      ...cardShadow
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.blueDark,
      letterSpacing: 0.8
    },
    input: {
      width: '100%',
      minHeight: 52,
      backgroundColor: theme.input,
      borderRadius: DESIGN.radius.md,
      paddingHorizontal: 14,
      marginBottom: 13,
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.border
    },
    pickerWrapper: {
      width: '100%',
      minHeight: 52,
      backgroundColor: theme.input,
      borderRadius: DESIGN.radius.md,
      marginBottom: 13,
      justifyContent: 'center',
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: theme.border
    },
    attachmentBtn: {
      width: '100%',
      minHeight: 58,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: theme.border,
      borderRadius: DESIGN.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 22,
      paddingHorizontal: 18
    },
    attachmentBtnText: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.subtext,
      marginTop: 5,
      textAlign: 'center'
    },

    // BUTTONS
    primaryButton: {
      width: '100%',
      minHeight: 56,
      backgroundColor: theme.blueDark,
      borderRadius: DESIGN.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.blueDark,
      shadowOpacity: isDark ? 0.28 : 0.16,
      shadowRadius: 12,
      elevation: 4
    },
    secondaryButton: {
      width: '100%',
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12
    },
    buttonText: {
      color: theme.whiteText,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0.5
    },
    secondaryButtonText: {
      color: theme.subtext,
      fontSize: 13,
      fontWeight: '900'
    },

    // TAB BAR
    tabBar: {
      position: 'absolute',
      bottom: Platform.OS === 'android' ? 24 : 22,
      left: 16,
      right: 16,
      minHeight: 68,
      backgroundColor: theme.blueDark,
      borderRadius: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      shadowColor: theme.blueDark,
      shadowOpacity: isDark ? 0.36 : 0.22,
      shadowRadius: 16,
      elevation: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.16)'
    },
    tabItem: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 58,
      minHeight: 52
    },
    tabText: {
      fontSize: 10,
      fontWeight: '900',
      color: 'rgba(255,255,255,0.58)',
      letterSpacing: 0.5,
      marginTop: 4
    },
    tabActive: {
      color: theme.whiteText
    },

    // FAB retained for compatibility; Home no longer renders it.
    fab: {
      position: 'absolute',
      bottom: 106,
      right: 22,
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: theme.orange,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.orange,
      shadowOpacity: 0.28,
      shadowRadius: 10,
      elevation: 5
    },
    emptyText: {
      textAlign: 'center',
      padding: 18,
      color: theme.subtext,
      fontWeight: '800',
      fontSize: 13,
      marginTop: 8
    }
  });
};
