"use client";

import { useState, type FormEvent } from "react";
import { ModalScrim } from "@/components/modal-scrim";
import { useToast } from "@/components/toast";
import { apiFetch, setStepUpToken } from "@/lib/api";

export function StepUpDialog({
  open,
  onClose,
  onSuccess,
  title = "Confirm your password",
  description = "Re-enter your account password to reveal this secret. Confirmation lasts 5 minutes.",
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ stepUpToken: string }>("/auth/step-up", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setStepUpToken(res.stepUpToken);
      setPassword("");
      toast.success("Identity confirmed");
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Confirmation failed";
      setError(msg);
      toast.error("Confirmation failed", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalScrim onClose={onClose}>
      <div
        className="vo-modal"
        style={{ maxWidth: 420 }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vo-modal-head">
          <h2 className="vo-modal-title">{title}</h2>
          <button type="button" className="vo-close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form className="vo-modal-body" onSubmit={(e) => void submit(e)}>
          <p className="vo-muted" style={{ fontSize: 13, marginBottom: 12 }}>
            {description}
          </p>
          <div className="vo-field">
            <label className="vo-label">Password</label>
            <input
              className="vo-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
          <div className="vo-modal-actions">
            <button type="button" className="vo-btn vo-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="vo-btn vo-btn-webmee" disabled={busy || !password}>
              {busy ? "Checking…" : "Confirm & reveal"}
            </button>
          </div>
        </form>
      </div>
    </ModalScrim>
  );
}
