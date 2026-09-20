import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
export default function PrimaryButton({ title, onPress, style }) { return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}><Text style={styles.text}>{title}</Text></Pressable>; }
const styles = StyleSheet.create({ button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md }, pressed: { backgroundColor: colors.primaryDark }, text: { ...typography.label, color: colors.white } });
