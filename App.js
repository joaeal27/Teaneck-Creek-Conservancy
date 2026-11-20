import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  getAuth,
  getIdToken,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from '@react-native-firebase/auth';

const firebaseAuth = getAuth();
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function requestApi(user, path, options = {}) {
  const token = await getIdToken(user);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error ?? 'The request could not be completed.');
  }

  return result;
}

function getAuthErrorMessage(code) {
  const messages = {
    'auth/email-already-in-use': 'An account already exists for this email.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/user-not-found': 'No account was found for this email.',
    'auth/weak-password': 'Choose a stronger password.',
    'auth/wrong-password': 'The email or password is incorrect.',
  };

  return messages[code] ?? 'Authentication failed. Please try again.';
}

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [trails, setTrails] = useState([]);
  const [trailName, setTrailName] = useState('');
  const [trailDescription, setTrailDescription] = useState('');
  const [isLoadingTrails, setIsLoadingTrails] = useState(false);
  const [isSavingTrail, setIsSavingTrail] = useState(false);
  const [trailError, setTrailError] = useState('');

  useEffect(
    () => onAuthStateChanged(firebaseAuth, setUser),
    [],
  );

  useEffect(() => {
    if (!user) {
      setTrails([]);
      return;
    }

    let isCurrent = true;
    setIsLoadingTrails(true);
    setTrailError('');
    requestApi(user, '/api/trails')
      .then((result) => {
        if (isCurrent) setTrails(result.trails);
      })
      .catch((error) => {
        if (isCurrent) setTrailError(error.message);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingTrails(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [user]);

  async function handleSubmit() {
    setErrorMessage('');
    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isCreatingAccount) {
        await createUserWithEmailAndPassword(firebaseAuth, trimmedEmail, password);
      } else {
        await signInWithEmailAndPassword(firebaseAuth, trimmedEmail, password);
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error?.code));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setErrorMessage('');
    try {
      await signOut(firebaseAuth);
    } catch {
      setErrorMessage('Could not sign out. Please try again.');
    }
  }

  async function handleCreateTrail() {
    setTrailError('');
    setIsSavingTrail(true);
    try {
      const result = await requestApi(user, '/api/trails', {
        method: 'POST',
        body: JSON.stringify({
          name: trailName.trim(),
          description: trailDescription.trim() || null,
        }),
      });
      setTrails((current) => [result.trail, ...current]);
      setTrailName('');
      setTrailDescription('');
    } catch (error) {
      setTrailError(error.message);
    } finally {
      setIsSavingTrail(false);
    }
  }

  if (user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.dashboardContent}>
          <View style={styles.content}>
            <Text style={styles.brand}>TEANECK CREEK CONSERVANCY</Text>
            <Text style={styles.title}>Trail directory</Text>
            <Text style={styles.subtitle}>Signed in as {user.email}</Text>

            <Text style={styles.sectionTitle}>Add a trail</Text>
            <TextInput
              onChangeText={setTrailName}
              placeholder="Trail name"
              placeholderTextColor="#7B8A7F"
              style={styles.input}
              value={trailName}
            />
            <TextInput
              onChangeText={setTrailDescription}
              placeholder="Description (optional)"
              placeholderTextColor="#7B8A7F"
              style={styles.input}
              value={trailDescription}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isSavingTrail || !trailName.trim()}
              onPress={handleCreateTrail}
              style={[
                styles.primaryButton,
                (isSavingTrail || !trailName.trim()) && styles.disabledButton,
              ]}
            >
              {isSavingTrail ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : null}
              {!isSavingTrail ? (
                <Text style={styles.primaryButtonText}>Save trail</Text>
              ) : null}
            </Pressable>

            <Text style={styles.sectionTitle}>Trails</Text>
            {trailError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {trailError}
              </Text>
            ) : null}
            {isLoadingTrails ? <ActivityIndicator color="#286343" /> : null}
            {!isLoadingTrails && trails.length === 0 && !trailError ? (
              <Text style={styles.trailDescription}>No trails have been added yet.</Text>
            ) : null}
            {trails.map((trail) => (
              <View key={trail.id} style={styles.trailCard}>
                <Text style={styles.trailName}>{trail.name}</Text>
                {trail.description ? (
                  <Text style={styles.trailDescription}>{trail.description}</Text>
                ) : null}
              </View>
            ))}
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            <Pressable style={styles.secondaryButton} onPress={handleSignOut}>
              <Text style={styles.secondaryButtonText}>Sign out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.brand}>TEANECK CREEK CONSERVANCY</Text>
            <Text style={styles.title}>
              {isCreatingAccount ? 'Create your account' : 'Welcome back'}
            </Text>
            <Text style={styles.subtitle}>
              {isCreatingAccount
                ? 'Sign up to continue.'
                : 'Sign in to continue to your account.'}
            </Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#7B8A7F"
              returnKeyType="next"
              style={styles.input}
              value={email}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete={isCreatingAccount ? 'new-password' : 'password'}
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              placeholder="Enter your password"
              placeholderTextColor="#7B8A7F"
              returnKeyType="done"
              secureTextEntry
              style={styles.input}
              value={password}
            />

            {errorMessage ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {errorMessage}
              </Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={handleSubmit}
              style={[styles.primaryButton, isSubmitting && styles.disabledButton]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isCreatingAccount ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              onPress={() => {
                setIsCreatingAccount((current) => !current);
                setErrorMessage('');
              }}
              style={styles.modeButton}
            >
              <Text style={styles.modeButtonText}>
                {isCreatingAccount
                  ? 'Already have an account? Sign in'
                  : 'New here? Create an account'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F4F7F1',
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 36,
  },
  dashboardContent: {
    flexGrow: 1,
    paddingVertical: 36,
  },
  content: {
    alignSelf: 'center',
    maxWidth: 480,
    paddingHorizontal: 28,
    width: '100%',
  },
  brand: {
    color: '#3A684C',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 20,
  },
  title: {
    color: '#183B2A',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#53665A',
    fontSize: 16,
    marginBottom: 30,
  },
  sectionTitle: {
    color: '#183B2A',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 14,
    marginTop: 16,
  },
  trailCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D5DED5',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  trailName: {
    color: '#183B2A',
    fontSize: 16,
    fontWeight: '700',
  },
  trailDescription: {
    color: '#53665A',
    fontSize: 14,
    marginTop: 6,
  },
  label: {
    color: '#263D30',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D5DED5',
    borderRadius: 10,
    borderWidth: 1,
    color: '#183B2A',
    fontSize: 16,
    marginBottom: 20,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  error: {
    color: '#A12A24',
    fontSize: 14,
    marginBottom: 16,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#286343',
    borderRadius: 10,
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 52,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modeButton: {
    alignItems: 'center',
    marginTop: 22,
    minHeight: 44,
    justifyContent: 'center',
  },
  modeButtonText: {
    color: '#286343',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: '#286343',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 22,
  },
  secondaryButtonText: {
    color: '#286343',
    fontSize: 15,
    fontWeight: '600',
  },
});
