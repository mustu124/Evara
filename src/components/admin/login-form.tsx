"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/admin/actions/auth";
import { adminInput, adminLabel, btnPrimary, Spinner } from "@/components/admin/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className={adminLabel}>Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className={adminInput} />
      </div>
      <div>
        <label htmlFor="password" className={adminLabel}>Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={adminInput} />
      </div>
      {state.error && <p role="alert" className="rounded-lg border border-blush bg-blush/40 px-3 py-2 text-sm font-medium text-cocoa">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending && <Spinner />} Sign in
      </button>
    </form>
  );
}
