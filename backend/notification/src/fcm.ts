import * as admin from 'firebase-admin';
import { getUserAttribute } from './keycloak';

const slog = (level: string, msg: string) =>
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'notification', message: msg }) + '\n');

/**
 * Initialize Firebase Admin SDK if credentials are available.
 * Called once at startup.
 */
export function initFirebase(): void {
  const credentialsJson = process.env.FIREBASE_CREDENTIALS_JSON;

  if (!credentialsJson) {
    slog('WARN', 'FIREBASE_CREDENTIALS_JSON not set — FCM push disabled');
    return;
  }

  try {
    const credentials = JSON.parse(credentialsJson);
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
    slog('INFO', 'Firebase Admin SDK initialized');
  } catch (error) {
    slog('ERROR', `Firebase initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Send a push notification via FCM.
 * Fetches the FCM token from Keycloak user attributes (not implemented here — would be done by a dedicated auth service).
 * If the token is unavailable, the push is silently skipped.
 * If FCM send fails, the error is logged but does not crash the service.
 */
export async function sendPush(
  driverId: string,
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<void> {
  if (!admin.apps.length) {
    return; // Firebase not initialized
  }

  // Try to load fcmToken from Keycloak user attributes (preferred in prod)
  let fcmToken: string | null = null;
  try {
    fcmToken = await getUserAttribute(driverId, 'fcm_token');
  } catch {}

  // Fallback to env-based token for local/dev scenarios
  if (!fcmToken) {
    fcmToken = process.env[`FCM_TOKEN_${driverId}`] ?? null;
  }

  if (!fcmToken) {
    slog('WARN', `No FCM token available for driver ${driverId}`);
    return;
  }

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification,
      data: data ?? {},
      android: {
        priority: 'high',
        notification: { sound: 'default' },
      },
      apns: {
        payload: {
          aps: { sound: 'default', badge: 1 },
        },
      },
    });
    slog('INFO', `FCM push sent to driver ${driverId}`);
  } catch (error) {
    // FCM failure is non-critical
    slog('WARN', `FCM push failed for driver ${driverId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
