import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
export default function SecondaryButton({ title, onPress, style }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}><Text style={styles.text}>{title}</Text></Pressable>; }
const styles = StyleSheet.create({ button: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }, pressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, text: { ...typography.label, color: colors.primary } });
