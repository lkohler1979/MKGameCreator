"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await login({ email, password });
      router.push("/home");
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível entrar.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center bg-gradient-to-b from-splash-from to-splash-to px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 animate-fade-in-up">
        <div className="flex flex-col items-center gap-1">
          <Crown className="size-8 fill-cta text-cta" />
          <h1 className="font-heading text-2xl font-extrabold tracking-tight text-white">
            Entrar
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4 rounded-2xl bg-card p-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-foreground">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-semibold text-foreground">
              Senha
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {errorMessage && <p className="text-sm font-semibold text-destructive">{errorMessage}</p>}

          <Button type="submit" variant="cta" size="xl" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : "Entrar"}
          </Button>
        </form>

        <p className="text-sm font-medium text-white/80">
          Não tem conta?{" "}
          <Link href="/signup" className="font-bold text-white underline underline-offset-2">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
