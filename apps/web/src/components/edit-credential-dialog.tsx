"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  formatCategoryLabel,
  isAccessKeyCategory,
  isSshCategory,
  isTokenCategory,
  PRESET_CREDENTIAL_CATEGORIES,
  updateCredentialSchema,
  type LoginKind,
  type UpdateCredentialInput,
} from "@vaultops/shared";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ModalScrim } from "@/components/modal-scrim";
import { useToast } from "@/components/toast";
import { ACCESS_DENIED, PERMS, useAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { resizeImageFileToDataUrl } from "@/lib/logo-upload";

export type CredentialMeta = {
  id: string;
  name: string;
  category: string;
  loginKind?: string;
  username: string | null;
  host?: string | null;
  port?: number | null;
  tags: string[];
  logoDataUrl?: string | null;
  notesPresent: boolean;
  expiresAt?: string | null;
  lastRotatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  shareCount?: number;
};

const LOGIN_KINDS: { value: LoginKind; label: string; hint: string }[] = [
  { value: "username", label: "Username", hint: "Username + password" },
  { value: "email", label: "Email", hint: "Email + password" },
  { value: "none", label: "Secret only", hint: "API key / token" },
];

function XIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}
function ShieldIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>;
}
function EyeIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function EyeOffIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 20C5 20 1 12 1 12a18.4 18.4 0 0 1 4.4-5.3"/><path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c7 0 11 7 11 7a18.6 18.6 0 0 1-2.2 3.2"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><line x1="2" y1="2" x2="22" y2="22"/></svg>;
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function EditCredentialDialog({
  credentialId,
  initial,
  onUpdated,
  trigger,
}: {
  credentialId: string;
  initial: CredentialMeta;
  onUpdated: (meta: CredentialMeta) => void;
  trigger?: ReactNode;
}) {
  const toast = useToast();
  const { can, ready } = useAccess();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoDataUrl ?? null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [keyFileName, setKeyFileName] = useState<string | null>(null);
  const [expiresInput, setExpiresInput] = useState(toDateInputValue(initial.expiresAt));
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [notesReady, setNotesReady] = useState(false);
  const initialRef = useRef(initial);
  initialRef.current = initial;

  function tryOpen() {
    if (ready && !can(PERMS.CREDENTIAL_WRITE)) {
      toast.error(ACCESS_DENIED.title, ACCESS_DENIED.credentialWrite);
      return;
    }
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setError(null);
    setShowSecret(false);
    setShowPassword(false);
    setShowPassphrase(false);
    setKeyFileName(null);
    setNotesReady(false);
    setLoadingEdit(false);
  }

  const form = useForm<UpdateCredentialInput>({
    resolver: zodResolver(updateCredentialSchema),
    defaultValues: {
      name: initial.name,
      category: initial.category,
      loginKind: (initial.loginKind as LoginKind) ?? "username",
      username: initial.username ?? "",
      host: initial.host ?? null,
      port: initial.port ?? (isSshCategory(initial.category) ? 22 : null),
      secret: "",
      password: null,
      passphrase: null,
      notes: "",
      logoDataUrl: initial.logoDataUrl ?? null,
      expiresAt: initial.expiresAt ?? null,
    },
  });

  const category = form.watch("category") ?? initial.category;
  const ssh = isSshCategory(category);
  const accessKey = isAccessKeyCategory(category);
  const token = isTokenCategory(category);
  const specialized = ssh || accessKey || token;
  const loginKind = (form.watch("loginKind") ?? "username") as LoginKind;
  const notesValue = form.watch("notes") ?? "";

  const categoryOptions = useMemo(() => {
    const set = new Set<string>([
      ...PRESET_CREDENTIAL_CATEGORIES,
      ...existingCategories,
      initial.category,
    ]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [existingCategories, initial.category]);

  // Load once per open — do not depend on `initial` / `form` or mid-edit parent
  // re-renders will wipe the form (felt like the modal "randomly closing").
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const snap = initialRef.current;

    setLoadingEdit(true);
    setNotesReady(false);
    setError(null);

    form.reset({
      name: snap.name,
      category: snap.category,
      loginKind: (snap.loginKind as LoginKind) ?? "username",
      username: snap.username ?? "",
      host: snap.host ?? null,
      port: snap.port ?? (isSshCategory(snap.category) ? 22 : null),
      secret: "",
      password: null,
      passphrase: null,
      notes: "",
      logoDataUrl: snap.logoDataUrl ?? null,
      expiresAt: snap.expiresAt ?? null,
    });
    setLogoPreview(snap.logoDataUrl ?? null);
    setExpiresInput(toDateInputValue(snap.expiresAt));
    setKeyFileName(null);
    setShowSecret(false);
    setShowPassword(false);
    setShowPassphrase(false);

    void (async () => {
      try {
        const [cats, editData] = await Promise.all([
          apiFetch<{ name: string }[]>("/categories").catch(() => [] as { name: string }[]),
          apiFetch<{ notes: string; password?: string }>(`/credentials/${credentialId}/edit`),
        ]);
        if (cancelled) return;
        setExistingCategories(cats.map((r) => r.name));
        form.setValue("notes", editData.notes ?? "", { shouldValidate: false });
        form.setValue("password", editData.password ?? "", { shouldValidate: false });
        setNotesReady(true);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Could not load credential for editing";
        setError(msg);
        setNotesReady(true);
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: open/id only
  }, [open, credentialId]);

  useEffect(() => {
    if (!open) return;
    if (ssh || accessKey) {
      form.setValue("loginKind", "username", { shouldValidate: true });
      if (ssh && form.getValues("port") == null) {
        form.setValue("port", 22, { shouldValidate: true });
      }
    } else if (token) {
      form.setValue("loginKind", "none", { shouldValidate: true });
    }
  }, [open, ssh, accessKey, token, form]);

  async function onLogoFile(file: File | null) {
    if (!file) {
      setLogoPreview(null);
      form.setValue("logoDataUrl", null);
      return;
    }
    setLogoBusy(true);
    setError(null);
    try {
      const dataUrl = await resizeImageFileToDataUrl(file);
      setLogoPreview(dataUrl);
      form.setValue("logoDataUrl", dataUrl, { shouldValidate: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read logo");
    } finally {
      setLogoBusy(false);
    }
  }

  async function onKeyFile(file: File | null) {
    if (!file) {
      setKeyFileName(null);
      return;
    }
    setError(null);
    try {
      const text = await file.text();
      form.setValue("secret", text.trim(), { shouldValidate: true });
      setKeyFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read key file");
    }
  }

  async function onSubmit(values: UpdateCredentialInput) {
    setError(null);
    try {
      const body: UpdateCredentialInput = {
        name: values.name,
        category: values.category,
        username: values.username?.trim() ? values.username.trim() : null,
        host: ssh ? values.host?.trim() || null : values.host?.trim() ? values.host.trim() : null,
        port: ssh ? (values.port ?? 22) : values.port ?? null,
        logoDataUrl: values.logoDataUrl || null,
        expiresAt: values.expiresAt ?? null,
      };
      if (values.secret?.trim()) {
        body.secret = values.secret.trim();
      }
      if (values.passphrase !== undefined && values.passphrase !== null) {
        body.passphrase = values.passphrase.trim() ? values.passphrase.trim() : "";
      }
      // Always send notes / SSH password once loaded so clears / edits persist.
      if (notesReady) {
        body.notes = values.notes ?? "";
        if (ssh) {
          body.password = values.password?.trim() ? values.password.trim() : "";
        }
      }
      if (!specialized && values.loginKind) {
        body.loginKind = values.loginKind;
      } else if (ssh || accessKey) {
        body.loginKind = "username";
      } else if (token) {
        body.loginKind = "none";
      }
      const updated = await apiFetch<CredentialMeta>(`/credentials/${credentialId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      close();
      toast.success("Credential updated", updated.name);
      onUpdated(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update credential";
      setError(msg);
      toast.error("Could not update credential", msg);
    }
  }

  const identityLabel = accessKey
    ? "Access key"
    : loginKind === "email"
      ? "Email"
      : loginKind === "username"
        ? "Username"
        : null;

  const secretFieldLabel = ssh
    ? "Private key"
    : accessKey
      ? "Secret access key"
      : token
        ? "Token"
        : loginKind === "none"
          ? "Secret / API key"
          : "Password / secret";

  const modalTitle = ssh
    ? "Edit SSH credential"
    : accessKey
      ? "Edit Access Key"
      : token
        ? "Edit Token"
        : "Edit credential";

  return (
    <>
      {trigger ? (
        <span onClick={tryOpen} role="presentation">{trigger}</span>
      ) : (
        <button type="button" className="vo-btn vo-btn-secondary" onClick={tryOpen}>
          Edit
        </button>
      )}

      {open && (
        <ModalScrim onClose={close}>
          <div
            className="vo-modal vo-modal--cred"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-cred-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vo-modal-head">
              <div className="vo-modal-head-text">
                <h2 id="edit-cred-title" className="vo-modal-title">{modalTitle}</h2>
                <p className="vo-modal-sub">Update metadata and optional secret. Leave secret blank to keep the current value.</p>
              </div>
              <button type="button" className="vo-close-btn" onClick={close} aria-label="Close"><XIcon /></button>
            </div>

            <form
              style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
              onSubmit={form.handleSubmit(onSubmit)}
            >
              {loadingEdit && (
                <div className="vo-modal-loading-inline" aria-live="polite">
                  <div className="vo-spinner" />
                  Loading encrypted fields…
                </div>
              )}
              <div className="vo-modal-body" style={{ opacity: loadingEdit ? 0.55 : 1, pointerEvents: loadingEdit ? "none" : undefined }}>
                  <section className="vo-modal-section">
                    <h3 className="vo-modal-section-title">Basics</h3>
                    <div className="vo-grid-2">
                      <div className="vo-field">
                        <label className="vo-label">Name</label>
                        <input className="vo-input" autoComplete="off" {...form.register("name")} />
                        {form.formState.errors.name && (
                          <span className="vo-field-err">{form.formState.errors.name.message}</span>
                        )}
                      </div>
                      <div className="vo-field">
                        <label className="vo-label">Category</label>
                        <select
                          className="vo-input"
                          value={category}
                          onChange={(e) => form.setValue("category", e.target.value, { shouldValidate: true })}
                        >
                          {categoryOptions.map((c) => (
                            <option key={c} value={c}>{formatCategoryLabel(c)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {ssh && (
                      <div className="vo-grid-2">
                        <div className="vo-field">
                          <label className="vo-label">Host</label>
                          <input
                            className="vo-input mono"
                            placeholder="server.example.com or user@server.example.com"
                            autoComplete="off"
                            {...form.register("host")}
                          />
                          <span className="vo-muted" style={{ fontSize: 11 }}>
                            Hostname, IP, or <span className="mono">user@host</span> connection string.
                          </span>
                        </div>
                        <div className="vo-field">
                          <label className="vo-label">Port</label>
                          <input
                            className="vo-input mono"
                            type="number"
                            min={1}
                            max={65535}
                            {...form.register("port", { valueAsNumber: true })}
                          />
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="vo-modal-section">
                    <h3 className="vo-modal-section-title">Access</h3>
                    {!specialized && (
                      <div className="vo-field">
                        <label className="vo-label">Login type</label>
                        <div className="vo-login-seg" role="radiogroup" aria-label="Login type">
                          {LOGIN_KINDS.map((k) => (
                            <button
                              key={k.value}
                              type="button"
                              className={`vo-login-seg-opt${loginKind === k.value ? " active" : ""}`}
                              onClick={() => form.setValue("loginKind", k.value, { shouldValidate: true })}
                            >
                              <strong>{k.label}</strong>
                              <span>{k.hint}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {(ssh || accessKey || identityLabel) && (
                      <div className="vo-field">
                        <label className="vo-label">
                          {ssh ? "Username" : accessKey ? "Access key" : identityLabel}
                        </label>
                        <input
                          className="vo-input mono"
                          type={!ssh && !accessKey && loginKind === "email" ? "email" : "text"}
                          placeholder={accessKey ? "AKIA…" : undefined}
                          autoComplete="off"
                          {...form.register("username")}
                        />
                      </div>
                    )}

                    {ssh ? (
                      <>
                        <div className="vo-field">
                          <label className="vo-label">Password</label>
                          <div className="vo-secret-wrap">
                            <input
                              className="vo-input mono"
                              type={showPassword ? "text" : "password"}
                              placeholder={loadingEdit ? "Loading…" : "SSH account password"}
                              autoComplete="new-password"
                              disabled={loadingEdit}
                              {...form.register("password")}
                            />
                            <button type="button" className="vo-secret-toggle" onClick={() => setShowPassword((v) => !v)}>
                              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                          </div>
                        </div>
                        <div className="vo-field">
                          <label className="vo-label">
                            Private key <span style={{ color: "var(--fg-3)" }}>(optional)</span>
                          </label>
                          <textarea
                            className="vo-textarea mono"
                            rows={5}
                            placeholder="Leave blank to keep current key"
                            autoComplete="off"
                            {...form.register("secret")}
                          />
                        </div>
                        <div className="vo-field">
                          <label className="vo-label">Key file <span style={{ color: "var(--fg-3)" }}>(optional)</span></label>
                          <label className="vo-file">
                            <span className="vo-file-btn">Choose key file</span>
                            <span className="vo-file-name">{keyFileName ?? "No file chosen"}</span>
                            <input
                              type="file"
                              accept=".pem,.key,.pub,text/plain,application/x-pem-file,application/octet-stream"
                              onChange={(e) => void onKeyFile(e.target.files?.[0] ?? null)}
                            />
                          </label>
                        </div>
                        <div className="vo-field">
                          <label className="vo-label">Key passphrase <span style={{ color: "var(--fg-3)" }}>(optional)</span></label>
                          <div className="vo-secret-wrap">
                            <input
                              className="vo-input mono"
                              type={showPassphrase ? "text" : "password"}
                              placeholder="Leave empty if unchanged"
                              autoComplete="new-password"
                              {...form.register("passphrase")}
                            />
                            <button type="button" className="vo-secret-toggle" onClick={() => setShowPassphrase((v) => !v)}>
                              {showPassphrase ? <EyeOffIcon /> : <EyeIcon />}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="vo-field">
                        <label className="vo-label">
                          {secretFieldLabel}{" "}
                          <span style={{ color: "var(--fg-3)" }}>(optional)</span>
                        </label>
                        <div className="vo-secret-wrap">
                          <input
                            className="vo-input mono"
                            type={showSecret ? "text" : "password"}
                            placeholder={
                              accessKey
                                ? "Leave blank to keep current secret access key"
                                : token
                                  ? "Leave blank to keep current token"
                                  : "Leave blank to keep current secret"
                            }
                            autoComplete="new-password"
                            {...form.register("secret")}
                          />
                          <button type="button" className="vo-secret-toggle" onClick={() => setShowSecret((v) => !v)}>
                            {showSecret ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="vo-modal-section">
                    <h3 className="vo-modal-section-title">Details</h3>
                    <div className="vo-field">
                      <label className="vo-label">
                        Notes <span style={{ color: "var(--fg-3)" }}>(encrypted)</span>
                      </label>
                      <textarea
                        className="vo-textarea"
                        rows={3}
                        placeholder="Owner, rotation tips, context…"
                        {...form.register("notes")}
                      />
                      {notesReady && !notesValue.trim() && initial.notesPresent && (
                        <span className="vo-muted" style={{ fontSize: 11 }}>
                          Notes were cleared in this form — save to remove them from the vault.
                        </span>
                      )}
                    </div>
                    <div className="vo-field">
                      <label className="vo-label">Expires <span style={{ color: "var(--fg-3)" }}>(optional)</span></label>
                      <input
                        className="vo-input"
                        type="date"
                        value={expiresInput}
                        onChange={(e) => {
                          const v = e.target.value;
                          setExpiresInput(v);
                          form.setValue("expiresAt", v || null, { shouldValidate: true });
                        }}
                      />
                    </div>
                    <div className="vo-field">
                      <label className="vo-label">Logo <span style={{ color: "var(--fg-3)" }}>(optional)</span></label>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="vo-cred-logo vo-cred-logo--lg">
                          {logoPreview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoPreview} alt="" />
                          ) : (
                            <span className="vo-cred-logo-fallback">?</span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <label className="vo-file">
                            <span className="vo-file-btn">Choose file</span>
                            <span className="vo-file-name">
                              {logoPreview && !logoPreview.startsWith("http") ? "Image selected" : "No file chosen"}
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,image/svg+xml"
                              disabled={logoBusy}
                              onChange={(e) => void onLogoFile(e.target.files?.[0] ?? null)}
                            />
                          </label>
                          <input
                            className="vo-input"
                            style={{ marginTop: 8 }}
                            placeholder="https://… logo URL"
                            value={logoPreview?.startsWith("http") ? logoPreview : ""}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              if (!v) {
                                if (!logoPreview?.startsWith("data:")) {
                                  setLogoPreview(null);
                                  form.setValue("logoDataUrl", null);
                                }
                                return;
                              }
                              setLogoPreview(v);
                              form.setValue("logoDataUrl", v, { shouldValidate: true });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="vo-enc-bar" style={{ marginTop: 8 }}>
                    <ShieldIcon />
                    <span>
                      Notes and SSH password load for editors. Private key stays hidden — paste a new key only if you want to replace it.
                    </span>
                  </div>

                  {error && (
                    <div style={{ fontSize: 13, color: "var(--red-400)", background: "rgba(224,70,74,0.07)", border: "1px solid rgba(224,70,74,0.2)", borderRadius: "var(--r-3)", padding: "10px 12px", marginTop: 12 }}>
                      {error}
                    </div>
                  )}
                </div>

                <div className="vo-modal-actions">
                  <button type="button" className="vo-btn vo-btn-ghost" onClick={close}>Cancel</button>
                  <button type="submit" className="vo-btn vo-btn-webmee" disabled={form.formState.isSubmitting || logoBusy || loadingEdit}>
                    {form.formState.isSubmitting
                      ? <><div className="vo-spinner" style={{ width: 13, height: 13, borderWidth: 1.5 }} />Saving…</>
                      : <><ShieldIcon />Save changes</>}
                  </button>
                </div>
            </form>
          </div>
        </ModalScrim>
      )}
    </>
  );
}
