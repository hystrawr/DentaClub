"use client";

import { use, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, LogIn } from "lucide-react";
import { Field, FormError, TextField } from "@/components/ui/form";
import { useSignIn } from "@/lib/api/auth";

/** Only a path on this site — never `//other.site`, which a browser treats as another host. */
function safeNext(next: string | string[] | undefined): Route {
  const value = typeof next === "string" ? next : "";
  return (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/login") ? value : "/") as Route;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = use(searchParams);
  const router = useRouter();
  const qc = useQueryClient();
  const signIn = useSignIn();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    signIn.mutate(
      { username: username.trim(), password },
      {
        onSuccess: (user) => {
          qc.setQueryData(["auth", "me"], user);
          router.replace(safeNext(next));
        },
        onError: () => setPassword(""),
      },
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--color-canvas)" }}>
      <div className="card-premium w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-5">
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{ width: 48, height: 48, background: "linear-gradient(135deg, #2563EB 0%, #0D9488 100%)" }}
            aria-hidden="true"
          >
            <Activity size={22} color="#fff" strokeWidth={2} />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
              DentaClub
            </h1>
            <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
              Sign in to continue
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="px-6 pb-8 space-y-4">
          <Field label="Username">
            <TextField value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" required />
          </Field>
          <Field label="Password">
            <TextField
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </Field>

          <FormError error={signIn.error} />

          <button
            type="submit"
            disabled={signIn.isPending || !username.trim() || !password}
            className="btn-gradient w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold disabled:opacity-40"
          >
            <LogIn size={16} />
            {signIn.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
