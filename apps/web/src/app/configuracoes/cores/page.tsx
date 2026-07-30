"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getColorConfig, updateColorConfig } from "@/lib/api";
import { DEFAULT_COLOR_ROLE_MAP, type ColorRoleEntry } from "@/lib/color-roles";
import { ROLE_OPTIONS } from "@/lib/element-roles";

const CONFIGURABLE_ROLE_OPTIONS = ROLE_OPTIONS.filter((option) => option.value !== "personagem");
const DEFAULT_NEW_COLOR = "#888888";

function makeId() {
  return Math.random().toString(36).slice(2);
}

type Row = ColorRoleEntry & { id: string };

function toRows(entries: ColorRoleEntry[]): Row[] {
  return entries.map((entry) => ({ ...entry, id: makeId() }));
}

export default function CoresConfigPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    getColorConfig()
      .then((entries) => setRows(toRows(entries ?? DEFAULT_COLOR_ROLE_MAP)))
      .finally(() => setLoading(false));
  }, []);

  function updateRow(id: string, patch: Partial<ColorRoleEntry>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function deleteRow(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  function addRow() {
    setRows((prev) => [...prev, { id: makeId(), color: DEFAULT_NEW_COLOR, role: "moeda" }]);
  }

  function restoreDefaults() {
    setRows(toRows(DEFAULT_COLOR_ROLE_MAP));
    setFeedback(null);
  }

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      await updateColorConfig(rows.map(({ color, role }) => ({ color, role })));
      setFeedback("Salvo!");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-4 sm:px-6">
        <Link
          href="/home"
          aria-label="Voltar"
          className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="font-heading text-lg font-bold text-foreground">Cores e Categorias</h1>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <p className="text-sm text-muted-foreground">
          Cada cor sugere uma categoria automaticamente ao marcar um desenho — a criança ainda pode trocar
          qualquer marcação na hora.
        </p>

        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
              <input
                type="color"
                value={row.color}
                onChange={(e) => updateRow(row.id, { color: e.target.value })}
                className="size-10 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                aria-label="Cor"
              />
              <select
                value={row.role}
                onChange={(e) => updateRow(row.id, { role: e.target.value as ColorRoleEntry["role"] })}
                className="h-10 flex-1 rounded-lg border border-border bg-background px-2 text-sm text-foreground"
              >
                {CONFIGURABLE_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.emoji} {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => deleteRow(row.id)}
                aria-label="Excluir cor"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={addRow}>
            <Plus className="size-4" /> Adicionar cor
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={restoreDefaults}>
            <RotateCcw className="size-4" /> Restaurar padrão
          </Button>
        </div>

        {feedback && (
          <p className="text-center text-sm font-semibold text-foreground">{feedback}</p>
        )}

        <Button variant="default" size="xl" className="w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </main>
    </div>
  );
}
