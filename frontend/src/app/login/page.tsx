"use client";

import { use, useRef, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { Field, FormError, TextField } from "@/components/ui/form";
import { useSignIn } from "@/lib/api/auth";

/** Only a path on this site — never `//other.site`, which a browser treats as another host. */
function safeNext(next: string | string[] | undefined): Route {
  const value = typeof next === "string" ? next : "";
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/login")
      ? value
      : "/"
  ) as Route;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  const passwordRef = useRef<HTMLInputElement>(null);
  const { next } = use(searchParams);
  const router = useRouter();
  const qc = useQueryClient();
  const signIn = useSignIn();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    signIn.mutate(
      { username: username.trim(), password },
      {
        onSuccess: (user) => {
          setUsername("");
          setPassword("");
          qc.setQueryData(["auth", "me"], user);
          router.replace(safeNext(next));
        },
        onError: () => setPassword(""),
      },
    );
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-2" style={{ background: "var(--color-canvas)" }}>
      {/* The brand panel (desktop only): a field of olive with the ornament drawn in cream. */}
      <aside
        className="hidden lg:flex flex-col justify-between p-12"
        style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        aria-hidden="true"
      >
        <div
          className="w-[min(60%,420px)] aspect-square self-center mt-auto"
          style={{
            background: "var(--color-primary-foreground)",
            opacity: 0.92,
            WebkitMask: "url(/brand/ornament.svg) center / contain no-repeat",
            mask: "url(/brand/ornament.svg) center / contain no-repeat",
          }}
        />
        <p className="mt-auto max-w-sm text-base leading-relaxed">
          Patient records, dental charts, consent forms and the day&apos;s appointments, in one place.
        </p>
      </aside>

      <main className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-6 pb-8">
            <Image src="/brand/wordmark.svg" alt="The DentaClub" width={192} height={64} priority unoptimized className="h-16 w-auto" />
            <div className="text-center">
              <h1 className="text-xl font-bold" style={{ color: "var(--color-foreground)" }}>
                Sign in
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                Use the account the clinic gave you.
              </p>
            </div>
          </div>

          <div className="card-premium">
            <form onSubmit={submit} className="p-6 space-y-4">
              <Field label="Username">
                <TextField
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !password) {
                      e.preventDefault();
                      passwordRef.current?.focus();
                    }
                  }}
                  placeholder="Enter your username"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoFocus
                  required
                />
              </Field>
              <Field label="Password">
                <div className="relative">
                  <TextField
                    type={showPassword ? "text" : "password"}
                    ref={passwordRef}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((show) => !show)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                    style={{ color: "var(--color-muted-foreground)" }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
      </main>
    </div>
  );
}
