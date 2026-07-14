"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type Me = {
  email: string;
  organization: { id: string; name: string } | null;
  roles: string[];
  kmsProvider: string;
  useLocalKms: boolean;
};

export default function EncryptionPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMe(await apiFetch<Me>("/org/me"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load status");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="vo-page-head">
        <div>
          <h1 className="vo-page-title">Encryption status</h1>
          <p className="vo-muted">Envelope encryption configuration for this environment.</p>
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {!me && !error && <p className="vo-muted">Loading…</p>}
      {me && (
        <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <div className="vo-panel">
            <div className="vo-panel-label">Algorithm</div>
            <div className="vo-panel-value">AES-256-GCM (application-layer)</div>
          </div>
          <div className="vo-panel">
            <div className="vo-panel-label">KMS provider</div>
            <div className="vo-panel-value">{me.kmsProvider}</div>
          </div>
          <div className="vo-panel">
            <div className="vo-panel-label">Local KMS</div>
            <div className="vo-panel-value">{me.useLocalKms ? "Enabled (dev only)" : "Disabled"}</div>
          </div>
          <div className="vo-panel">
            <div className="vo-panel-label">Organization</div>
            <div className="vo-panel-value">{me.organization?.name ?? "—"}</div>
          </div>
          <p className="vo-muted" style={{ fontSize: 13 }}>
            Per-credential DEKs are wrapped by the configured KMS. Plaintext never leaves the API process.
          </p>
        </div>
      )}
    </div>
  );
}
