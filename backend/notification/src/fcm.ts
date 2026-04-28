import * as admin from 'firebase-admin';

const slog = (level: string, msg: string, extra?: object) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'notification', message: msg, ...extra }) + '\n');

let firebaseApp: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    firebaseApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return firebaseApp;
  } catch (e) {
    slog('WARN', `Firebase init failed: ${(e as Error).message}`);
    return null;
  }
}

async function getDriverFcmToken(_driverId: string): Promise<string | null> {
  // Production: load fcm_token from Keycloak user attributes via Admin REST API.
  return null;
}

export async function sendPush(
  driverId: string,
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<void> {
  const fcmToken = await getDriverFcmToken(driverId);
  if (!fcmToken) {
    slog('WARN', 'No FCM token for driver', { driver_id: driverId });
    return;
  }
  const app = getFirebaseApp();
  if (!app) return;

  try {
    await admin.messaging(app).send({
      token: fcmToken,
      notification,
      data: data ?? {},
      android: { priority: 'high', notification: { sound: 'default' } },
      apns:    { payload: { aps: { sound: 'default', badge: 1 } } },
    });
  } catch (error) {
    slog('WARN', 'FCM push failed', { driver_id: driverId, error: (error as Error).message });
  }
}
