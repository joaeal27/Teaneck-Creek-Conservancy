import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure using the webClientId found in Firebase Console > Authentication > Google > Web SDK configuration
GoogleSignin.configure({
  webClientId: '317479041154-r6r5nmfd9uqaeql3htba2lqahl3geat2.apps.googleusercontent.com',
});

async function onGoogleButtonPress() {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const signInResult = await GoogleSignin.signIn();
  const idToken = signInResult.data?.idToken;

  const googleCredential = auth.GoogleAuthProvider.credential(idToken);
  return auth().signInWithCredential(googleCredential);
}