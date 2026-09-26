import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import ScreenContainer from '../../components/ScreenContainer';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../auth';
import { apiClient } from '../../api';

export  function LoginScreen({ navigation }) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const goToRole = (role) =>
    navigation.replace(
      role === 'admin' ? 'AdminFlow' : 'InstallerFlow'
    );

  const handleLogin = async () => {
    setErrorMessage('');

    const identifier = email.trim();

    if (!identifier) {
      setErrorMessage('Please enter your email or phone number');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await login(identifier, password);

      if (result.success && result.user) {
        const targetFlow =
          result.user.role === 'ADMIN'
            ? 'AdminFlow'
            : 'InstallerFlow';

        navigation.replace(targetFlow);
      } else {
        setErrorMessage(result.error || 'Invalid credentials');
      }
    } catch (err) {
      setErrorMessage(
        err.message || 'Login failed. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandArea}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>TI</Text>
            </View>

            <Text style={styles.title}>TrackInstall</Text>

            <Text style={styles.subtitle}>
              Installer Visit Management System
            </Text>
          </View>

          <View style={styles.form}>
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Email</Text>

            <TextInput
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) {
                  setErrorMessage('');
                }
              }}
              placeholder="Enter your email"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="default"
              style={styles.input}
            />

            <Text style={styles.label}>Password</Text>

            <TextInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) {
                  setErrorMessage('');
                }
              }}
              placeholder="Enter your password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoComplete="password"
              style={styles.input}
            />

            <PrimaryButton
              title={
                isSubmitting ? 'Logging in...' : 'Login'
              }
              onPress={
                isSubmitting ? undefined : handleLogin
              }
              style={
                isSubmitting
                  ? styles.buttonDisabled
                  : undefined
              }
            />

            <SecondaryButton
              title="Activate Account"
              onPress={() =>
                navigation.navigate('ActivateAccount')
              }
              style={styles.activateButton}
            />
          </View>

          <View style={styles.demoSection}>
            <View style={styles.dividerRow}>
              <View style={styles.divider} />

              <Text style={styles.dividerText}>
                Demo Login
              </Text>

              <View style={styles.divider} />
            </View>

            <Text style={styles.demoDescription}>
              Explore the prototype using a demo role.
            </Text>

            <SecondaryButton
              title="Continue as Admin"
              onPress={() => goToRole('admin')}
            />

            <SecondaryButton
              title="Continue as Installer"
              onPress={() => goToRole('installer')}
              style={styles.secondDemoButton}
            />
          </View>

          <View style={styles.mode}>
            <View style={styles.modeDot} />

            <Text style={styles.modeText}>
              Demo Mode
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export function ActivateAccountScreen({ navigation, route }) {
  const [activationToken, setActivationToken] = useState(
    route?.params?.activationToken || ''
  );

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleActivate = async () => {
    setErrorMessage('');

    if (!activationToken.trim()) {
      setErrorMessage(
        'Please enter your activation token'
      );
      return;
    }

    if (!password) {
      setErrorMessage(
        'Please enter a new password'
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        'Password must be at least 8 characters long'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        'Passwords do not match'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/auth/activate', {
        activationToken: activationToken.trim(),
        password,
      });

      Alert.alert(
        'Account Activated',
        'Your account has been activated successfully. You can now log in with your new password.',
        [
          {
            text: 'Go to Login',
            onPress: () => navigation.replace('Login'),
          },
        ]
      );
    } catch (err) {
      setErrorMessage(
        err.message ||
          'Unable to activate your account.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandArea}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>TI</Text>
            </View>

            <Text style={styles.title}>
              Activate Account
            </Text>

            <Text style={styles.subtitle}>
              Use the activation token provided by your
              administrator to create your password.
            </Text>
          </View>

          <View style={styles.form}>
            {errorMessage ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>
              Activation Token
            </Text>

            <TextInput
              value={activationToken}
              onChangeText={(text) => {
                setActivationToken(text);

                if (errorMessage) {
                  setErrorMessage('');
                }
              }}
              placeholder="Enter activation token"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={styles.label}>
              New Password
            </Text>

            <TextInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);

                if (errorMessage) {
                  setErrorMessage('');
                }
              }}
              placeholder="Enter new password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              style={styles.input}
            />

            <Text style={styles.label}>
              Confirm Password
            </Text>

            <TextInput
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);

                if (errorMessage) {
                  setErrorMessage('');
                }
              }}
              placeholder="Confirm new password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              style={styles.input}
            />

            <PrimaryButton
              title={
                isSubmitting
                  ? 'Activating...'
                  : 'Activate Account'
              }
              onPress={
                isSubmitting
                  ? undefined
                  : handleActivate
              }
              style={
                isSubmitting
                  ? styles.buttonDisabled
                  : undefined
              }
            />

            <SecondaryButton
              title="Back to Login"
              onPress={() => navigation.goBack()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.lg,
  },

  flex: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
    paddingVertical: spacing.xxl,
  },

  brandArea: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },

  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },

  logoText: {
    ...typography.heading,
    color: colors.white,
  },

  title: {
    ...typography.display,
    color: colors.text,
  },

  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  form: {
    gap: spacing.sm,
  },

  label: {
    ...typography.label,
    color: colors.text,
    marginTop: spacing.sm,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    ...typography.body,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  activateButton: {
    marginTop: spacing.sm,
  },

  errorContainer: {
    backgroundColor: '#FEE4E2',
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: '#FECDCA',
  },

  errorText: {
    ...typography.caption,
    color: '#B42318',
    textAlign: 'center',
  },

  demoSection: {
    marginTop: spacing.xxl,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  dividerText: {
    ...typography.label,
    color: colors.textSecondary,
  },

  demoDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.md,
  },

  secondDemoButton: {
    marginTop: spacing.sm,
  },

  mode: {
    marginTop: 'auto',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xxl,
  },

  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },

  modeText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});