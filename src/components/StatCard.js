import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme';
export default function StatCard({ label, value }) { return <View style={styles.card}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View>; }
const styles = StyleSheet.create({ card: { width: '48%', minHeight: 122, justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, ...shadow.card }, value: { ...typography.title, color: colors.text }, label: { ...typography.caption, color: colors.textSecondary } });
