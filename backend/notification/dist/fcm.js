"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initFirebase = initFirebase;
exports.sendPush = sendPush;
const admin = __importStar(require("firebase-admin"));
const slog = (level, msg) => process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), level, service: 'notification', message: msg }) + '\n');
/**
 * Initialize Firebase Admin SDK if credentials are available.
 * Called once at startup.
 */
function initFirebase() {
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
    }
    catch (error) {
        slog('ERROR', `Firebase initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Send a push notification via FCM.
 * Fetches the FCM token from Keycloak user attributes (not implemented here — would be done by a dedicated auth service).
 * If the token is unavailable, the push is silently skipped.
 * If FCM send fails, the error is logged but does not crash the service.
 */
async function sendPush(driverId, notification, data) {
    if (!admin.apps.length) {
        return; // Firebase not initialized
    }
    // In a real deployment, fetch fcmToken from Keycloak user attributes.
    // For now, we assume the token would be passed in or fetched from a user store.
    const fcmToken = process.env[`FCM_TOKEN_${driverId}`];
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
    }
    catch (error) {
        // FCM failure is non-critical
        slog('WARN', `FCM push failed for driver ${driverId}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
