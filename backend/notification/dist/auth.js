"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyKeycloakToken = verifyKeycloakToken;
exports.extractToken = extractToken;
exports.getRole = getRole;
const jsonwebtoken_1 = require("jsonwebtoken");
/**
 * Verify a JWT token from Keycloak.
 * If KEYCLOAK_PUBLIC_KEY is not set, tokens are not verified (dev mode).
 */
function verifyKeycloakToken(token) {
    const publicKey = process.env.KEYCLOAK_PUBLIC_KEY;
    if (!publicKey) {
        // Dev mode: skip verification, just decode
        return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    }
    try {
        return (0, jsonwebtoken_1.verify)(token, publicKey, { algorithms: ['RS256'] });
    }
    catch (error) {
        throw new Error(`Token verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
/**
 * Extract JWT from handshake (token in auth or Authorization header).
 */
function extractToken(handshake) {
    return handshake.auth?.token || handshake.headers?.authorization?.replace('Bearer ', '');
}
/**
 * Get user role from decoded token. Returns the first role or 'viewer' default.
 */
function getRole(decoded) {
    return decoded.realm_access?.roles?.[0] ?? 'viewer';
}
