import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';
export default function ScreenContainer({ children, style }) { return <SafeAreaView style={[styles.container, style]} edges={['top', 'left', 'right']}>{children}</SafeAreaView>; }
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md } });
