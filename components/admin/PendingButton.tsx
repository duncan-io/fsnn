"use client";

import { useFormStatus } from "react-dom";

export function PendingButton({
  idle,
  pending,
  disabled = false,
  variant = "primary",
}: {
  idle: string;
  pending: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
}) {
  const status = useFormStatus();
  const off = disabled || status.pending;
  const tone =
    variant === "primary"
      ? "border-accent bg-accent text-black"
      : "border-line bg-transparent text-foreground hover:border-accent hover:text-accent";

  return (
    <button
      type="submit"
      disabled={off}
      className={`border px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
    >
      {status.pending ? pending : idle}
    </button>
  );
}
