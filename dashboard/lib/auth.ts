"use client";

import {
  CognitoUser,
  CognitoUserPool,
  AuthenticationDetails,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";

// Public SPA client — no secret, matches the deployed Manifest-Auth CDK stack.
const USER_POOL_ID = "us-east-1_IEkSgybfT";
const CLIENT_ID = "3v16s2463btorvslcb3m9pmg0o";

const SESSION_KEY = "manifest.session";

function getPool(): CognitoUserPool {
  return new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID });
}

export interface StoredSession {
  idToken: string;
  email: string;
  expiresAt: number;
}

export function login(email: string, password: string): Promise<StoredSession> {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: getPool() });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    user.authenticateUser(authDetails, {
      onSuccess: (session: CognitoUserSession) => {
        const stored: StoredSession = {
          idToken: session.getIdToken().getJwtToken(),
          email,
          expiresAt: session.getIdToken().getExpiration() * 1000,
        };
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(stored));
        } catch {
          // sessionStorage unavailable (private browsing etc.) — session just won't persist across reloads.
        }
        resolve(stored);
      },
      onFailure: (err) => reject(err),
      newPasswordRequired: () => {
        reject(new Error("This account requires a new password. Contact the broker admin."));
      },
    });
  });
}

export function getSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed: StoredSession = JSON.parse(raw);
    if (parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function logout(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
