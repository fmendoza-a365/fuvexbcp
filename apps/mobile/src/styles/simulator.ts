import { StyleSheet } from 'react-native';
import { COLORS, DARK_COLORS } from '../constants/theme';

export const createSimStyles = (isDark: boolean) => {
  const theme = isDark ? DARK_COLORS : COLORS;
  
  return StyleSheet.create({
    simResultCard: { backgroundColor: theme.white, borderRadius: 12, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: theme.blue, shadowColor: theme.blue, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2 },
    simResultTitle: { fontSize: 14, fontWeight: '900', color: theme.blue, letterSpacing: 1, marginBottom: 15, textAlign: 'center' },
    simGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
    simStat: { width: '48%', marginBottom: 15 },
    simStatLabel: { fontSize: 9, fontWeight: '900', color: theme.subtext, letterSpacing: 1, marginBottom: 4 },
    simStatValue: { fontSize: 16, fontWeight: 'bold', color: theme.text },
    simHighlight: { width: '100%', backgroundColor: theme.input, padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 14 },
    simHighlightLabel: { fontSize: 10, fontWeight: '900', color: theme.blue, letterSpacing: 1.5, marginBottom: 5 },
    simHighlightValue: { fontSize: 32, fontWeight: '900', color: theme.orange },
    rciBadge: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
    rciBadgeText: { fontSize: 11, fontWeight: 'bold' }
  });
};
