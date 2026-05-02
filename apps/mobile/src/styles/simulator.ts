import { StyleSheet } from 'react-native';
import { COLORS, DARK_COLORS } from '../constants/theme';

export const createSimStyles = (isDark: boolean) => {
  const theme = isDark ? DARK_COLORS : COLORS;
  
  return StyleSheet.create({
    simResultCard: { backgroundColor: theme.white, borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 2, borderColor: theme.blue, shadowColor: theme.blue, shadowOpacity: 0.1, shadowRadius: 15, elevation: 3 },
    simResultTitle: { fontSize: 14, fontWeight: '900', color: theme.blue, letterSpacing: 1, marginBottom: 15, textAlign: 'center' },
    simGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
    simStat: { width: '48%', marginBottom: 15 },
    simStatLabel: { fontSize: 9, fontWeight: '900', color: theme.subtext, letterSpacing: 1, marginBottom: 4 },
    simStatValue: { fontSize: 16, fontWeight: 'bold', color: theme.text },
    simHighlight: { width: '100%', backgroundColor: theme.slate, padding: 15, borderRadius: 20, alignItems: 'center', marginBottom: 15 },
    simHighlightLabel: { fontSize: 10, fontWeight: '900', color: theme.blue, letterSpacing: 1.5, marginBottom: 5 },
    simHighlightValue: { fontSize: 32, fontWeight: '900', color: theme.orange },
    rciBadge: { alignSelf: 'center', paddingHorizontal: 15, paddingVertical: 6, borderRadius: 12 },
    rciBadgeText: { fontSize: 11, fontWeight: 'bold' }
  });
};
