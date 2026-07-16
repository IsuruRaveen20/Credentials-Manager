"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EditCredentialDialog,
  type CredentialMeta,
} from "@/components/edit-credential-dialog";
import { SharePanel } from "@/components/share-panel";
import { StepUpDialog } from "@/components/step-up-dialog";
import { copyToClipboard, useToast } from "@/components/toast";
import { ACCESS_DENIED, PERMS, useAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { categoryColor, formatCategoryLabel } from "@/lib/categories";
import { isAccessKeyCategory, isSshCategory, isTokenCategory } from "@vaultops/shared";

type Revealed = CredentialMeta & {
  secret: string;
  notes: string;
  password?: string | null;
  passphrase?: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  createdAt: string;
  actor: { id: string; email: string } | null;
};

function EyeIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function EyeOffIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M17.9 17.9A10.4 10.4 0 0 1 12 20C5 20 1 12 1 12a18.4 18.4 0 0 1 4.4-5.3"/><path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c7 0 11 7 11 7a18.6 18.6 0 0 1-2.2 3.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><line x1="2" y1="2" x2="22" y2="22"/></svg>;
}
function CopyIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
}
function ShieldIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
}
function ArrowIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
}
function VaultIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="12" r="4"/><path d="M12 16v2"/></svg>;
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleString();
}

function formatAuditAction(action: string): string {
  return action.replace(/\./g, " · ");
}

function isStepUpRequired(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("confirm your password") ||
    msg.includes("step_up") ||
    msg.includes("step-up") ||
    msg.includes("unauthorized")
  );
}

function SecretField({
  label,
  value,
  mono = false,
  secret = false,
  /** After server-side Reveal / step-up, show cleartext by default. */
  initiallyVisible = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  secret?: boolean;
  initiallyVisible?: boolean;
}) {
  const toast = useToast();
  const [visible, setVisible] = useState(initiallyVisible || !secret);
  const display = secret && !visible ? "•".repeat(Math.min(Math.max(value.length, 8), 32)) : value;

  async function copy() {
    const ok = await copyToClipboard(value);
    if (ok) toast.success("Copied to clipboard", label);
    else toast.error("Copy failed", "Clipboard permission denied");
  }

  return (
    <div className="vo-sf">
      <div className="vo-sf-label">{label}</div>
      <div className="vo-sf-row">
        <div className={`vo-sf-val ${mono ? "mono" : ""}`}>{display}</div>
        {secret && (
          <button
            type="button"
            className="vo-sf-btn"
            onClick={() => setVisible((v) => !v)}
            title={visible ? "Hide on screen" : "Show on screen"}
          >
            {visible ? <EyeOffIcon width={13} height={13} /> : <EyeIcon width={13} height={13} />}
          </button>
        )}
        <button type="button" className="vo-sf-btn" onClick={() => void copy()} title="Copy">
          <CopyIcon width={13} height={13} />
        </button>
      </div>
    </div>
  );
}

function PropRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="vo-prop-row">
      <span className="vo-prop-k">{k}</span>
      <span className="vo-prop-v">{v}</span>
    </div>
  );
}

export default function CredentialDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = useMemo(() => params?.id, [params]);
  const toast = useToast();
  const { can } = useAccess();
  const [meta, setMeta] = useState<CredentialMeta | null>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [retryRevealAfterStepUp, setRetryRevealAfterStepUp] = useState(false);

  const loadAudit = useCallback(async (resourceId: string) => {
    try {
      const rows = await apiFetch<AuditRow[]>(
        `/audit?resourceId=${encodeURIComponent(resourceId)}&limit=20`,
      );
      setAuditRows(rows);
    } catch {
      setAuditRows([]);
    }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const m = await apiFetch<CredentialMeta>(`/credentials/${id}`);
      setMeta(m);
      setRevealed(null);
      void loadAudit(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load credential");
    }
  }, [id, loadAudit]);

  useEffect(() => { void load(); }, [load]);

  const reveal = useCallback(async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<Revealed>(`/credentials/${id}/reveal`);
      setRevealed(r);
      toast.success("Secret revealed", "This action was written to the audit log");
      void loadAudit(id);
    } catch (e) {
      if (isStepUpRequired(e)) {
        setRetryRevealAfterStepUp(true);
        setStepUpOpen(true);
        return;
      }
      const msg = e instanceof Error ? e.message : "Reveal failed";
      setError(msg);
      toast.error("Reveal failed", msg);
    } finally {
      setBusy(false);
    }
  }, [id, loadAudit, toast]);

  async function onStepUpSuccess() {
    if (retryRevealAfterStepUp) {
      setRetryRevealAfterStepUp(false);
      await reveal();
    }
  }

  async function removeCredential() {
    if (!id || !meta) return;
    if (!can(PERMS.CREDENTIAL_DELETE)) {
      toast.error(ACCESS_DENIED.title, ACCESS_DENIED.credentialDelete);
      return;
    }
    if (!window.confirm(`Delete "${meta.name}"? This cannot be undone.`)) return;
    setDeleteBusy(true);
    setError(null);
    try {
      await apiFetch(`/credentials/${id}`, { method: "DELETE" });
      toast.success("Credential deleted", meta.name);
      router.push("/vault");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      setError(msg);
      toast.error("Delete failed", msg);
    } finally {
      setDeleteBusy(false);
    }
  }

  const ssh = meta ? isSshCategory(meta.category) : false;
  const accessKey = meta ? isAccessKeyCategory(meta.category) : false;
  const token = meta ? isTokenCategory(meta.category) : false;
  const color = categoryColor(meta?.category ?? "other");
  const identityLabel = accessKey
    ? "Access key"
    : meta?.loginKind === "email"
      ? "Email"
      : meta?.loginKind === "none"
        ? null
        : "Username";
  const secretLabel = ssh
    ? "Private key"
    : accessKey
      ? "Secret access key"
      : token
        ? "Token"
        : meta?.loginKind === "none"
          ? "Secret / API key"
          : "Password / secret";

  return (
    <div>
      <StepUpDialog
        open={stepUpOpen}
        onClose={() => {
          setStepUpOpen(false);
          setRetryRevealAfterStepUp(false);
        }}
        onSuccess={() => void onStepUpSuccess()}
      />

      <div className="vo-page-head">
        <div>
          <Link href="/vault" className="vo-back-link">
            ← Back to vault
          </Link>
          <div className="vo-cred-title-row">
            {meta?.logoDataUrl ? (
              <span className="vo-cred-logo vo-cred-logo--lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={meta.logoDataUrl} alt="" />
              </span>
            ) : (
              <div
                className="vo-cred-fallback-icon"
                style={{
                  background: `${color}1A`,
                  borderColor: `${color}44`,
                  color,
                }}
              >
                <VaultIcon width={20} height={20} />
              </div>
            )}
            <div>
              <h1 className="vo-page-title" style={{ fontSize: 22 }}>{meta?.name ?? "Loading…"}</h1>
              <div className="vo-cred-meta-row">
                <span className="vo-badge vo-badge-secure"><span className="vo-badge-dot" />Encrypted</span>
                <span style={{ color: "var(--fg-3)", fontSize: 12 }}>·</span>
                <span style={{ fontSize: 12, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                  {meta?.category ? formatCategoryLabel(meta.category) : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="vo-page-actions">
          {meta && (
            <>
              <EditCredentialDialog
                credentialId={meta.id}
                initial={meta}
                onUpdated={(m) => {
                  setMeta(m);
                  setRevealed(null);
                }}
              />
              <button
                type="button"
                className="vo-btn vo-btn-secondary"
                onClick={() => void removeCredential()}
                disabled={deleteBusy}
              >
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </>
          )}
          {!revealed && (
            <button
              type="button"
              className="vo-btn vo-btn-webmee"
              onClick={() => void reveal()}
              disabled={busy || !meta}
              title="Decrypt the password/secret from the server (audited)"
            >
              {busy ? <div className="vo-spinner" /> : <EyeIcon width={13} height={13} />}
              {busy ? "Decrypting…" : "Reveal"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="vo-card" style={{ borderColor: "rgba(224,70,74,0.3)", background: "rgba(224,70,74,0.06)", marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "var(--red-400)" }}>{error}</p>
        </div>
      )}

      <div className="vo-detail">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="vo-sidecard" style={{ background: "var(--bg-elev-2)" }}>
            <div className="vo-sidecard-head">Secret material</div>
            {meta && (
              <>
                {ssh && meta.host && (
                  <SecretField label="Host" value={`${meta.host}${meta.port ? `:${meta.port}` : ""}`} mono />
                )}
                {identityLabel && meta.username && (
                  <SecretField label={identityLabel} value={meta.username} mono />
                )}
                {revealed ? (
                  <>
                    {ssh && revealed.password && (
                      <SecretField label="Password" value={revealed.password} mono secret initiallyVisible />
                    )}
                    {revealed.secret && (
                      <SecretField label={secretLabel} value={revealed.secret} mono secret initiallyVisible />
                    )}
                    {revealed.passphrase && (
                      <SecretField label="Key passphrase" value={revealed.passphrase} mono secret initiallyVisible />
                    )}
                    {revealed.notes && (
                      <SecretField label="Notes" value={revealed.notes} />
                    )}
                  </>
                ) : (
                  <div className="vo-sf">
                    <div className="vo-sf-label">{ssh ? "Password & private key" : secretLabel}</div>
                    <div className="vo-sf-row">
                      <div className="vo-sf-val" style={{ color: "var(--fg-3)" }}>
                        {"•".repeat(32)}
                      </div>
                      <button
                        type="button"
                        className="vo-sf-btn"
                        onClick={() => void reveal()}
                        disabled={busy}
                        style={{ opacity: busy ? 0.5 : 1 }}
                        title="Reveal (audited)"
                      >
                        {busy ? <div className="vo-spinner" style={{ width: 12, height: 12 }} /> : <EyeIcon width={13} height={13} />}
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 6 }}>
                      Secrets stay encrypted until you reveal them. Each reveal is audited.
                    </div>
                  </div>
                )}
                {!revealed && meta.notesPresent && (
                  <div className="vo-sf">
                    <div className="vo-sf-label">Notes</div>
                    <div style={{ fontSize: 12, color: "var(--fg-3)" }}>Encrypted alongside the secret — reveal to view.</div>
                  </div>
                )}
              </>
            )}
            {!meta && (
              <div style={{ padding: "20px 14px", display: "flex", alignItems: "center", gap: 8, color: "var(--fg-3)" }}>
                <div className="vo-spinner" />
                <span style={{ fontSize: 13 }}>Loading…</span>
              </div>
            )}
          </div>

          {meta && meta.tags.length > 0 && (
            <div className="vo-sidecard" style={{ background: "var(--bg-elev-2)" }}>
              <div className="vo-sidecard-head">Tags</div>
              <div style={{ padding: "12px 14px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                {meta.tags.map((t) => <span key={t} className="vo-tag">{t}</span>)}
              </div>
            </div>
          )}

          <div className="vo-sidecard" style={{ background: "var(--bg-elev-2)" }}>
            <div className="vo-sidecard-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>Access history</span>
              <Link
                href="/audit"
                style={{ background: "none", border: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--brand-300)", textDecoration: "none" }}
              >
                View full log <ArrowIcon width={11} height={11} />
              </Link>
            </div>
            <div style={{ padding: "10px 14px" }}>
              {auditRows.length === 0 ? (
                <p className="vo-muted" style={{ fontSize: 12, margin: 0 }}>No audit events for this credential yet.</p>
              ) : (
                <div className="vo-tl">
                  {auditRows.map((row) => (
                    <div key={row.id} className="vo-ev">
                      <div className="vo-ev-body">
                        <b>{row.actor?.email ?? "system"}</b> {formatAuditAction(row.action)}
                      </div>
                      <div className="vo-ev-when" title={new Date(row.createdAt).toLocaleString()}>
                        {formatRelativeTime(row.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="vo-sidecard" style={{ marginBottom: 12 }}>
            <div className="vo-sidecard-head">Properties</div>
            {meta ? (
              <>
                <PropRow k="Category" v={formatCategoryLabel(meta.category)} />
                {meta.host && <PropRow k="Host" v={meta.host} />}
                {meta.port != null && <PropRow k="Port" v={String(meta.port)} />}
                <PropRow
                  k="Login type"
                  v={
                    ssh
                      ? "SSH key"
                      : meta.loginKind === "email"
                        ? "Email + password"
                        : meta.loginKind === "none"
                          ? "Secret only"
                          : "Username + password"
                  }
                />
                <PropRow k="Has notes" v={meta.notesPresent ? "Yes" : "No"} />
                {meta.expiresAt && (
                  <PropRow k="Expires" v={new Date(meta.expiresAt).toLocaleDateString()} />
                )}
                {meta.lastRotatedAt && (
                  <PropRow k="Last rotated" v={new Date(meta.lastRotatedAt).toLocaleString()} />
                )}
                <PropRow
                  k="Shared with"
                  v={`${meta.shareCount ?? 0} people · ${meta.groupShareCount ?? 0} groups`}
                />
                <PropRow k="Created" v={new Date(meta.createdAt).toLocaleDateString()} />
                <PropRow k="Updated" v={new Date(meta.updatedAt).toLocaleDateString()} />
                <PropRow k="ID" v={meta.id.slice(0, 8) + "…"} />
              </>
            ) : (
              <div style={{ padding: "12px 14px" }}>
                <div className="vo-spinner" />
              </div>
            )}
          </div>

          {meta && <SharePanel credentialId={meta.id} />}

          <div className="vo-sidecard">
            <div className="vo-sidecard-head">Encryption</div>
            <PropRow k="Cipher" v="AES-256-GCM" />
            <PropRow k="KMS" v="Local (dev)" />
            <PropRow k="Key rotation" v="Per-credential DEK" />
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--hairline)", display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldIcon width={13} height={13} style={{ color: "var(--emerald-400)" }} />
              <span style={{ fontSize: 12, color: "var(--emerald-400)" }}>End-to-end encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
