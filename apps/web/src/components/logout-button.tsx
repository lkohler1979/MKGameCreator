"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, User } from "lucide-react";

import { logout } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/login");
      router.refresh();
    } catch (error) {
      setIsLoggingOut(false);
      window.alert(error instanceof Error ? error.message : "Não foi possível sair.");
    }
  }

  return (
    <button
      type="button"
      aria-label="Sair"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-50"
    >
      {isLoggingOut ? <Loader2 className="size-4 animate-spin" /> : <User className="size-5" />}
    </button>
  );
}
