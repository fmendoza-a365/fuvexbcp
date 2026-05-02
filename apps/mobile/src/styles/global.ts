import { StyleSheet, Platform, StatusBar } from 'react-native';
import { COLORS, DARK_COLORS } from '../constants/theme';

export const createStyles = (isDark: boolean) => {
  const theme = isDark ? DARK_COLORS : COLORS;
  
  return StyleSheet.create({

  safeArea: {
    flex: 1,
    backgroundColor: theme.slate,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 15 : 0
  },
  container: { flex: 1 },
  mainScroll: { flex: 1, paddingHorizontal: 20 },

  // LOGIN
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
    backgroundColor: theme.slate
  },
  loginHeaderDecorator: {
    position: 'absolute',
    top: -50,
    left: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0, 42, 141, 0.05)',
  },
  loginFooterDecorator: {
    position: 'absolute',
    bottom: -150,
    right: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(255, 120, 0, 0.03)',
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 40
  },
  loginLogo: {
    width: 200,
    height: 70,
    marginBottom: 20
  },
  loginWelcomeTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.blue,
    letterSpacing: -0.5
  },
  loginWelcomeSubtitle: {
    fontSize: 14,
    color: theme.subtext,
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
    fontWeight: '600'
  },
  loginCard: {
    width: '100%',
    backgroundColor: theme.white,
    borderRadius: 32,
    paddingHorizontal: 25,
    paddingVertical: 35,
    shadowColor: theme.blue,
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 8
  },
  inputGroup: {
    marginBottom: 20,
    width: '100%'
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.subtext,
    letterSpacing: 1.5,
    marginBottom: 8,
    marginLeft: 5
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    paddingHorizontal: 15,
    height: 60,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  inputIcon: {
    marginRight: 12,
    width: 20,
    textAlign: 'center'
  },
  loginInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    backgroundColor: 'transparent'
  },
  loginBtn: {
    backgroundColor: theme.orange,
    height: 65,
    borderRadius: 22,
    marginTop: 10,
    shadowColor: theme.orange,
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  loginBtnText: {
    color: theme.white,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    marginRight: 10
  },
  forgotBtn: {
    marginTop: 20,
    alignItems: 'center'
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.subtext
  },
  loginFooterText: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: theme.subtext,
    fontWeight: '700'
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.slate,
    padding: 12,
    borderRadius: 15,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EDF2F7'
  },
  attachmentBadgeText: {
    fontSize: 13,
    color: theme.text,
    fontWeight: '600',
    flex: 1,
    marginRight: 10
  },

  // ATTACHMENTS REDESIGN
  attachmentSection: {
    marginBottom: 25,
    marginTop: 10
  },
  attachmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15
  },
  attachmentCount: {
    backgroundColor: theme.blue,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  attachmentCountText: {
    color: theme.white,
    fontSize: 10,
    fontWeight: 'bold'
  },
  uploadZone: {
    width: '100%',
    height: 120,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  uploadCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#FFF2E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.blue
  },
  uploadSubtitle: {
    fontSize: 11,
    color: theme.subtext,
    marginTop: 2
  },
  attachmentsList: {
    marginBottom: 10
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.white,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 2
  },
  fileIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  fileInfo: {
    flex: 1
  },
  fileName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 2
  },
  fileType: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.blue
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF1F2',
    alignItems: 'center',
    justifyContent: 'center'
  },

  // HEADER
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, paddingTop: 20 },
  welcomeText: { fontSize: 22, fontWeight: '900', color: theme.blue, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: theme.subtext, fontWeight: '600' },
  profileBtn: { width: 45, height: 45, borderRadius: 15, backgroundColor: theme.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  profileInitial: { fontSize: 18, fontWeight: 'bold', color: theme.orange },

  // KPI
  kpiGrid: { marginBottom: 30 },
  kpiGridLandscape: { flexDirection: 'row' },
  mainKpiCard: { backgroundColor: theme.white, borderRadius: 24, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 15, elevation: 2 },
  kpiLabel: { fontSize: 10, fontWeight: '900', color: theme.subtext, letterSpacing: 1.5, marginBottom: 10 },
  progressContainer: { marginTop: 5 },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  kpiValue: { fontSize: 36, fontWeight: '900', color: theme.blue, letterSpacing: -1 },
  kpiSubValue: { fontSize: 16, fontWeight: 'bold', color: theme.orange, marginBottom: 5 },
  progressBarBg: { width: '100%', height: 12, backgroundColor: theme.slate, borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  progressBarFill: { height: '100%', backgroundColor: theme.orange, borderRadius: 6 },
  metaLabel: { fontSize: 11, fontWeight: '700', color: theme.subtext },

  commissionCard: { backgroundColor: theme.blue, borderRadius: 24, padding: 20, shadowColor: theme.blue, shadowOpacity: 0.3, shadowRadius: 15, elevation: 5 },
  commissionValue: { fontSize: 28, fontWeight: '900', color: theme.white, marginVertical: 5 },
  commissionNote: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' },

  // SECTIONS
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: theme.subtext, letterSpacing: 1.5 },
  seeAllText: { fontSize: 11, fontWeight: '900', color: theme.orange, marginRight: 3 },

  quickList: { backgroundColor: theme.white, borderRadius: 24, padding: 10, marginBottom: 20 },
  saleItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: theme.slate },
  statusIndicator: { width: 4, height: 30, borderRadius: 2, marginRight: 15 },
  saleName: { fontSize: 15, fontWeight: 'bold', color: theme.text, marginBottom: 2 },
  saleMeta: { fontSize: 12, color: theme.subtext, fontWeight: '600' },

  // LIST
  fullSaleCard: { backgroundColor: theme.white, borderRadius: 20, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: theme.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardDni: { fontSize: 12, fontWeight: '900', color: theme.subtext },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  cardName: { fontSize: 17, fontWeight: 'bold', color: theme.blue, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardAmount: { fontSize: 16, fontWeight: '900', color: theme.text },
  cardDate: { fontSize: 12, color: theme.subtext, fontWeight: '700' },
  warningAlert: { marginTop: 15, padding: 12, backgroundColor: '#FFFBEB', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  warningText: { fontSize: 10, fontWeight: '900', color: '#D97706' },

  // FORM
  formCard: { backgroundColor: theme.white, borderRadius: 24, padding: 20, marginBottom: 100 },
  inputLabel: { fontSize: 11, fontWeight: '900', color: theme.blue, letterSpacing: 1 },
  input: { width: '100%', height: 55, backgroundColor: theme.slate, borderRadius: 15, paddingHorizontal: 20, marginBottom: 15, fontSize: 15, fontWeight: '600', color: theme.text },
  pickerWrapper: { width: '100%', height: 55, backgroundColor: theme.slate, borderRadius: 15, marginBottom: 15, justifyContent: 'center', paddingHorizontal: 10 },
  attachmentBtn: { width: '100%', height: 60, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.border, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 25, paddingHorizontal: 20 },

  attachmentBtnText: { fontSize: 11, fontWeight: '900', color: theme.subtext, marginTop: 5, textAlign: 'center' },

  // BUTTONS
  primaryButton: { width: '100%', height: 65, backgroundColor: theme.orange, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: theme.orange, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  secondaryButton: { width: '100%', height: 50, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  buttonText: { color: theme.white, fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  secondaryButtonText: { color: theme.subtext, fontSize: 14, fontWeight: '900' },

  // TAB BAR
  tabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 60 : 40,
    left: 20,
    right: 20,
    height: 75,
    backgroundColor: theme.blue,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: theme.blue,
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10
  },
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, marginTop: 4 },
  tabActive: { color: theme.white },

  // FAB
  fab: { position: 'absolute', bottom: 125, right: 25, width: 65, height: 65, borderRadius: 32.5, backgroundColor: theme.orange, alignItems: 'center', justifyContent: 'center', shadowColor: theme.orange, shadowOpacity: 0.4, shadowRadius: 10, elevation: 5 },
  emptyText: { textAlign: 'center', padding: 20, color: theme.subtext, fontWeight: 'bold', fontSize: 13, fontStyle: 'italic', marginTop: 10 }
  });
};
