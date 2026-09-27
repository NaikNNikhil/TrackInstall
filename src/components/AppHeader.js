import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

export default function AppHeader({ greeting }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>TrackInstall</Text>
        <Text style={styles.greeting}>{greeting}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },

  brand: {
    ...typography.heading,
    color: colors.primary,
  },

  greeting: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});