// @polsia:framework-owned - DO NOT EDIT. Code installed by polsia/modules/better-auth@0.7.0. Drift = commit rejected.
//
// better-auth React client (v1.6.x). Client-safe: NO server secrets, NO
// server-only imports — safe to import from 'use client' components. baseURL
// comes from the client-scoped NEXT_PUBLIC_APP_URL in @/lib/env; the auth
// endpoints are mounted at /api/auth/* by the catch-all route handler.
// Includes adminClient so the user's role is inferred and admin permission
// helpers are available to client UI. Server-side enforcement still belongs in
// route handlers and server helpers.

import { adminClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { env } from '@/lib/env';

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  plugins: [adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

/**
 * `true` when the signed-in user is an admin (`role === 'admin'`, the admin
 * plugin's field). The client analogue of the server `requireAdmin()` gate —
 * use it to gate admin-only UI (a nav link, a button, a section). Returns
 * `false` while the session is still loading and for logged-out visitors.
 *
 * The role lives on **`data.user.role`**. It is NOT `data.session.user.role` —
 * `useSession()` returns `{ user, session }` where `session` is the session
 * RECORD (token/expiry), with no nested `user`. Reading `session.user.role`
 * (the Auth.js/NextAuth idiom) is a common but wrong port for better-auth and
 * silently yields `undefined`. Use this helper instead of hand-reading the
 * session shape (and never cast it with `as unknown as` to force a path).
 */
export function useIsAdmin(): boolean {
  const { data } = useSession();
  return data?.user?.role === 'admin';
}
