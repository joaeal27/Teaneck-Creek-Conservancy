import React, { useEffect, useState } from 'react';
import * as SQLite from 'expo-sqlite';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Map } from '@maplibre/maplibre-react-native';
import {
  ActivityIndicator,
  Image,
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
import length from '@turf/length';

const firebaseAuthEnabled = process.env.EXPO_PUBLIC_FIREBASE_ENABLED === 'true';
const firebaseAuthModule = firebaseAuthEnabled
  ? require('@react-native-firebase/auth')
  : null;
const firebaseAuth = firebaseAuthModule?.getAuth() ?? null;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const sampleTrailLengthKm = length(
  {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        [-74.0147, 40.8979],
        [-74.0118, 40.8996],
        [-74.009, 40.901],
      ],
    },
  },
  { units: 'kilometers' },
).toFixed(2);
let showcaseDatabase;

function TrailMap() {
  return (
    <>
      <View style={styles.mapContainer}>
        <Map
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
        >
          <Camera
            centerCoordinate={[-74.0147, 40.8979]}
            zoomLevel={13}
          />
        </Map>
      </View>
      <Text style={styles.mapCaption}>
        Turf.js GeoJSON example: sample trail length is {sampleTrailLengthKm} km.
      </Text>
    </>
  );
}

async function requestApi(path, options = {}, user = null) {
  const token =
    user && firebaseAuthModule
      ? await firebaseAuthModule.getIdToken(user)
      : null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

async function getSQLiteShowcaseTrails() {
  if (!showcaseDatabase) {
    showcaseDatabase = await SQLite.openDatabaseAsync('tcc-showcase.db');
  }

  await showcaseDatabase.execAsync(`
    CREATE TABLE IF NOT EXISTS showcase_trails (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    );
    INSERT OR IGNORE INTO showcase_trails (id, name, description)
    VALUES
      (1, 'Overpeck Creek Trail', 'A sample trail saved on this device.'),
      (2, 'Forest Edge Walk', 'SQLite keeps this demo data available offline.');
  `);

  return showcaseDatabase.getAllAsync(
    'SELECT id, name, description FROM showcase_trails ORDER BY id',
  );
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
  const [trailPhoto, setTrailPhoto] = useState(null);
  const [isLoadingTrails, setIsLoadingTrails] = useState(false);
  const [isSavingTrail, setIsSavingTrail] = useState(false);
  const [trailError, setTrailError] = useState('');
  const [isShowcaseVisible, setIsShowcaseVisible] = useState(false);
  const [isLoadingShowcase, setIsLoadingShowcase] = useState(false);
  const [showcaseTrails, setShowcaseTrails] = useState([]);
  const [showcaseError, setShowcaseError] = useState('');
  const [isSQLiteShowcaseVisible, setIsSQLiteShowcaseVisible] = useState(false);
  const [isLoadingSQLiteShowcase, setIsLoadingSQLiteShowcase] = useState(false);
  const [sqliteTrails, setSQLiteTrails] = useState([]);
  const [sqliteError, setSQLiteError] = useState('');

  useEffect(() => {
    if (!firebaseAuthModule || !firebaseAuth) {
      return undefined;
    }

    return firebaseAuthModule.onAuthStateChanged(firebaseAuth, setUser);
  }, []);

  useEffect(() => {
    if (!user) {
      setTrails([]);
      return;
    }

    let isCurrent = true;
    setIsLoadingTrails(true);
    setTrailError('');
    requestApi('/api/trails', {}, user)
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
      if (!firebaseAuthModule || !firebaseAuth) {
        throw new Error('Firebase authentication is disabled for this build.');
      }

      if (isCreatingAccount) {
        await firebaseAuthModule.createUserWithEmailAndPassword(
          firebaseAuth,
          trimmedEmail,
          password,
        );
      } else {
        await firebaseAuthModule.signInWithEmailAndPassword(
          firebaseAuth,
          trimmedEmail,
          password,
        );
      }
    } catch (error) {
      setErrorMessage(
        error?.code
          ? getAuthErrorMessage(error.code)
          : error.message,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setErrorMessage('');
    try {
      if (!firebaseAuthModule || !firebaseAuth) {
        throw new Error('Firebase authentication is disabled for this build.');
      }

      await firebaseAuthModule.signOut(firebaseAuth);
    } catch {
      setErrorMessage('Could not sign out. Please try again.');
    }
  }

  async function handleShowcasePress() {
    if (isShowcaseVisible) {
      setIsShowcaseVisible(false);
      return;
    }

    setIsShowcaseVisible(true);
    setIsLoadingShowcase(true);
    setShowcaseError('');
    try {
      const result = await requestApi('/api/trails');
      setShowcaseTrails(result.trails);
    } catch (error) {
      setShowcaseError(error.message);
    } finally {
      setIsLoadingShowcase(false);
    }
  }

  async function handleSQLiteShowcasePress() {
    if (isSQLiteShowcaseVisible) {
      setIsSQLiteShowcaseVisible(false);
      return;
    }

    setIsSQLiteShowcaseVisible(true);
    setIsLoadingSQLiteShowcase(true);
    setSQLiteError('');
    try {
      const result = await getSQLiteShowcaseTrails();
      setSQLiteTrails(result);
    } catch (error) {
      setSQLiteError(error.message);
    } finally {
      setIsLoadingSQLiteShowcase(false);
    }
  }

  async function handleChoosePhoto() {
    setTrailError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setTrailError('Photo library permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.base64) {
      setTrailError('This photo could not be read.');
      return;
    }
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      setTrailError('Photo must be no larger than 10 MB.');
      return;
    }

    setTrailPhoto({
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  }

  async function handleCreateTrail() {
    setTrailError('');
    setIsSavingTrail(true);
    try {
      const result = await requestApi('/api/trails', {
        method: 'POST',
        body: JSON.stringify({
          name: trailName.trim(),
          description: trailDescription.trim() || null,
          photo: trailPhoto,
        }),
      }, user);
      setTrails((current) => [result.trail, ...current]);
      setTrailName('');
      setTrailDescription('');
      setTrailPhoto(null);
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
            <Text style={styles.sectionTitle}>Map</Text>
            <TrailMap />

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
            {trailPhoto ? (
              <Image
                accessibilityLabel="Selected trail photo"
                source={{ uri: `data:${trailPhoto.mimeType};base64,${trailPhoto.base64}` }}
                style={styles.trailPhotoPreview}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={handleChoosePhoto}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {trailPhoto ? 'Change photo' : 'Choose photo'}
              </Text>
            </Pressable>
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
                {trail.photoUrl ? (
                  <Image source={{ uri: trail.photoUrl }} style={styles.trailPhoto} />
                ) : null}
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
              {firebaseAuthEnabled
                ? isCreatingAccount
                  ? 'Create your account'
                  : 'Welcome back'
                : 'Explore Teaneck Creek'}
            </Text>
            <Text style={styles.subtitle}>
              {firebaseAuthEnabled
                ? isCreatingAccount
                  ? 'Sign up to continue.'
                  : 'Sign in to continue to your account.'
                : 'Firebase authentication is disabled for this simulator build. The map and read-only trail samples remain available.'}
            </Text>
            <Text style={styles.sectionTitle}>Explore Teaneck Creek</Text>
            <TrailMap />

            {firebaseAuthEnabled ? (
              <>
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
                  style={[
                    styles.primaryButton,
                    isSubmitting && styles.disabledButton,
                  ]}
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
              </>
            ) : null}

            <View style={styles.showcase}>
              <Text style={styles.sectionTitle}>Explore the database</Text>
              <Text style={styles.trailDescription}>
                Browse trail records stored in PostgreSQL. This directory is public and read-only.
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={isLoadingShowcase}
                onPress={handleShowcasePress}
                style={[
                  styles.secondaryButton,
                  isLoadingShowcase && styles.disabledButton,
                ]}
              >
                {isLoadingShowcase ? (
                  <ActivityIndicator color="#286343" />
                ) : (
                  <Text style={styles.secondaryButtonText}>
                    {isShowcaseVisible ? 'Hide trails' : 'Show PostgreSQL trails'}
                  </Text>
                )}
              </Pressable>
              {showcaseError ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {showcaseError}
                </Text>
              ) : null}
              {isShowcaseVisible && !isLoadingShowcase && showcaseTrails.length === 0 && !showcaseError ? (
                <Text style={styles.emptyState}>
                  PostgreSQL is connected, but there are no trail records yet.
                </Text>
              ) : null}
              {isShowcaseVisible
                ? showcaseTrails.map((trail) => (
                    <View key={trail.id} style={styles.trailCard}>
                      {trail.photoUrl ? (
                        <Image source={{ uri: trail.photoUrl }} style={styles.trailPhoto} />
                      ) : null}
                      <Text style={styles.trailName}>{trail.name}</Text>
                      {trail.description ? (
                        <Text style={styles.trailDescription}>{trail.description}</Text>
                      ) : null}
                    </View>
                  ))
                : null}
              <Text style={styles.trailDescription}>
                View sample trails stored locally in SQLite. They are available offline on this device.
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={isLoadingSQLiteShowcase}
                onPress={handleSQLiteShowcasePress}
                style={[
                  styles.secondaryButton,
                  isLoadingSQLiteShowcase && styles.disabledButton,
                ]}
              >
                {isLoadingSQLiteShowcase ? (
                  <ActivityIndicator color="#286343" />
                ) : (
                  <Text style={styles.secondaryButtonText}>
                    {isSQLiteShowcaseVisible ? 'Hide SQLite trails' : 'Show SQLite trails'}
                  </Text>
                )}
              </Pressable>
              {sqliteError ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {sqliteError}
                </Text>
              ) : null}
              {isSQLiteShowcaseVisible && !isLoadingSQLiteShowcase && sqliteTrails.length === 0 && !sqliteError ? (
                <Text style={styles.emptyState}>
                  SQLite is ready, but there are no sample trails yet.
                </Text>
              ) : null}
              {isSQLiteShowcaseVisible
                ? sqliteTrails.map((trail) => (
                    <View key={trail.id} style={styles.trailCard}>
                      <Text style={styles.trailName}>{trail.name}</Text>
                      {trail.description ? (
                        <Text style={styles.trailDescription}>{trail.description}</Text>
                      ) : null}
                    </View>
                  ))
                : null}
            </View>
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
  showcase: {
    borderTopColor: '#D5DED5',
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 10,
  },
  mapContainer: {
    borderColor: '#D5DED5',
    borderRadius: 10,
    borderWidth: 1,
    height: 280,
    overflow: 'hidden',
  },
  mapCaption: {
    color: '#53665A',
    fontSize: 14,
    marginBottom: 18,
    marginTop: 8,
  },
  emptyState: {
    color: '#53665A',
    fontSize: 14,
    marginTop: 16,
  },
  trailPhotoPreview: {
    borderRadius: 10,
    height: 220,
    marginBottom: 8,
    resizeMode: 'cover',
    width: '100%',
  },
  trailPhoto: {
    borderRadius: 8,
    height: 180,
    marginBottom: 10,
    resizeMode: 'cover',
    width: '100%',
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
