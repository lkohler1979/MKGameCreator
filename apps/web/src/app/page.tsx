import Link from "next/link";
import { ArrowRight, Crown, Gamepad2, Pencil, Sparkles } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { GoogleIcon, MicrosoftIcon } from "@/components/brand-icons";
import { cn } from "@/lib/utils";

const DECORATIVE_STARS = [
  { top: "8%", left: "12%", size: 18, delay: "0s" },
  { top: "18%", left: "82%", size: 14, delay: "0.4s" },
  { top: "38%", left: "6%", size: 12, delay: "0.8s" },
  { top: "58%", left: "88%", size: 20, delay: "0.2s" },
  { top: "78%", left: "10%", size: 14, delay: "0.6s" },
  { top: "12%", left: "48%", size: 10, delay: "1s" },
];

export default function SplashPage() {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-splash-from to-splash-to px-6 py-12 text-center">
      {DECORATIVE_STARS.map((star, index) => (
        <Sparkles
          key={index}
          className="pointer-events-none absolute animate-pulse text-white/20"
          style={{ top: star.top, left: star.left, width: star.size, height: star.size, animationDelay: star.delay }}
        />
      ))}

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8 animate-fade-in-up">
        <div className="flex flex-col items-center gap-1">
          <Crown className="size-9 fill-cta text-cta" />
          <h1 className="font-heading text-5xl font-extrabold tracking-tight text-cta">
            MK
          </h1>
          <p className="font-heading text-2xl font-bold tracking-wide text-white">
            GAME CREATOR
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex size-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white/10 text-white">
            <Pencil className="size-6" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              Desenho
            </span>
          </div>
          <ArrowRight className="size-6 shrink-0 text-white/70" />
          <div className="flex size-16 flex-col items-center justify-center gap-1 rounded-2xl bg-white/10 text-white">
            <Gamepad2 className="size-6" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              Jogo
            </span>
          </div>
        </div>

        <p className="font-heading text-2xl font-bold leading-snug text-white">
          Transforme qualquer
          <br />
          desenho em um jogo!
        </p>

        <Link
          href="/home"
          className={cn(buttonVariants({ variant: "cta", size: "xl" }), "w-full")}
        >
          Começar
          <ArrowRight className="size-5" />
        </Link>

        <div className="flex w-full flex-col items-center gap-4">
          <div className="flex w-full items-center gap-3">
            <span className="h-px flex-1 bg-white/20" />
            <span className="font-sans text-sm font-semibold text-white/70">
              Entrar com
            </span>
            <span className="h-px flex-1 bg-white/20" />
          </div>

          <div className="flex w-full gap-3">
            <Button
              variant="outline"
              size="lg"
              className="h-12 flex-1 rounded-full border-transparent bg-white text-foreground hover:bg-white/90"
            >
              <GoogleIcon className="size-5" />
              Google
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 flex-1 rounded-full border-transparent bg-white text-foreground hover:bg-white/90"
            >
              <MicrosoftIcon className="size-5" />
              Microsoft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
