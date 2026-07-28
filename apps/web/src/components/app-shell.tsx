import Link from "next/link";
import { Bell, Gamepad2, Home, User } from "lucide-react";

const FOOTER_LINKS = ["Ajuda", "Sobre", "Política", "Contato"];

const BOTTOM_NAV_ITEMS = [
  { label: "Início", icon: Home, active: true },
  { label: "Meus Jogos", icon: Gamepad2, active: false },
  { label: "Perfil", icon: User, active: false },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <Link href="/home" className="flex items-center gap-1.5">
          <span className="font-heading text-lg font-extrabold text-primary">
            MK
          </span>
          <span className="font-heading text-sm font-bold tracking-wide text-foreground">
            GAME CREATOR
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Notificações"
            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          >
            <Bell className="size-5" />
          </button>
          <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <User className="size-5" />
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      <footer className="hidden border-t border-border bg-card py-4 md:block">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-6 text-sm font-semibold text-muted-foreground">
          {FOOTER_LINKS.map((label) => (
            <span key={label} className="cursor-default">
              {label}
            </span>
          ))}
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-card md:hidden">
        {BOTTOM_NAV_ITEMS.map(({ label, icon: Icon, active }) => (
          <div
            key={label}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-5" />
            {label}
          </div>
        ))}
      </nav>
    </div>
  );
}
