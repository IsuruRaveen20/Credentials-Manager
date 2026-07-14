"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  createCredentialSchema,
  formatCategoryLabel,
  isAccessKeyCategory,
  isSshCategory,
  isTokenCategory,
  PRESET_CREDENTIAL_CATEGORIES,
  type CreateCredentialInput,
  type LoginKind,
} from "@vaultops/shared";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ModalScrim } from "@/components/modal-scrim";
import { useToast } from "@/components/toast";
import { ACCESS_DENIED, PERMS, useAccess } from "@/lib/access";
import { apiFetch } from "@/lib/api";
import { resizeImageFileToDataUrl } from "@/lib/logo-upload";

function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>;
}
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

const LOGIN_KINDS: { value: LoginKind; label: string; hint: string }[] = [
  { value: "username", label: "Username", hint: "Username + password" },
  { value: "email", label: "Email", hint: "Email + password" },
  { value: "none", label: "Secret only", hint: "API key / token" },
];

const DEFAULT_VALUES: CreateCredentialInput = {
  name: "",
  category: "Login Credentials",
  loginKind: "username",
  username: "",
  host: null,
  port: null,
  secret: "",
  password: null,
  passphrase: null,
  notes: "",
  tags: [],
  logoDataUrl: null,
  expiresAt: null,
};

export function AddCredentialDialog({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const { can, ready } = useAccess();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [keyFileName, setKeyFileName] = useState<string | null>(null);
  const [expiresInput, setExpiresInput] = useState("");

  const form = useForm<CreateCredentialInput>({
    resolver: zodResolver(createCredentialSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const category = form.watch("category") ?? "Login Credentials";
  const loginKind = form.watch("loginKind") ?? "username";
  const ssh = isSshCategory(category);
  const accessKey = isAccessKeyCategory(category);
  const token = isTokenCategory(category);
  const specialized = ssh || accessKey || token;

  const categoryOptions = useMemo(() => {
    const set = new Set<string>([...PRESET_CREDENTIAL_CATEGORIES, ...existingCategories]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [existingCategories]);

  useEffect(() => {
    if (!open) return;
    void apiFetch<{ name: string }[]>("/categories")
      .then((rows) => setExistingCategories(rows.map((r) => r.name)))
      .catch(() => setExistingCategories([]));
  }, [open]);

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

  async function onSubmit(values: CreateCredentialInput) {
    setError(null);
    try {
      const body: CreateCredentialInput = {
        ...values,
        loginKind: ssh || accessKey ? "username" : token ? "none" : values.loginKind,
        host: ssh ? values.host?.trim() || null : values.host?.trim() ? values.host.trim() : null,
        port: ssh ? (values.port ?? 22) : values.port ?? null,
        password: ssh && values.password?.trim() ? values.password.trim() : null,
        passphrase: values.passphrase?.trim() ? values.passphrase.trim() : null,
        secret: values.secret?.trim() ?? "",
        expiresAt: values.expiresAt || null,
        logoDataUrl: values.logoDataUrl || null,
      };
      await apiFetch("/credentials", {
        method: "POST",
        body: JSON.stringify(body),
      });
      form.reset(DEFAULT_VALUES);
      setLogoPreview(null);
      setExpiresInput("");
      setKeyFileName(null);
      setOpen(false);
      toast.success("Credential saved", values.name);
      onCreated();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create credential";
      setError(msg);
      toast.error("Could not save credential", msg);
    }
  }

  function close() {
    form.reset(DEFAULT_VALUES);
    setLogoPreview(null);
    setExpiresInput("");
    setKeyFileName(null);
    setError(null);
    setOpen(false);
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
    ? "New SSH credential"
    : accessKey
      ? "New Access Key"
      : token
        ? "New Token"
        : "New credential";

  return (
    <>
      <button
        type="button"
        className="vo-btn vo-btn-webmee"
        onClick={() => {
          if (ready && !can(PERMS.CREDENTIAL_WRITE)) {
            toast.error(ACCESS_DENIED.title, ACCESS_DENIED.credentialWrite);
            return;
          }
          setOpen(true);
        }}
      >
        <PlusIcon />Add credential
      </button>

      {open && (
        <ModalScrim onClose={close}>
          <div
            className="vo-modal vo-modal--cred"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-cred-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vo-modal-head">
              <div className="vo-modal-head-text">
                <h2 id="add-cred-title" className="vo-modal-title">{modalTitle}</h2>
                <p className="vo-modal-sub">Stored encrypted with AES-256-GCM. Pick a category and login type, then add the secret.</p>
              </div>
              <button type="button" className="vo-close-btn" onClick={close} aria-label="Close"><XIcon /></button>
            </div>

            <form
              style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
              onSubmit={form.handleSubmit(onSubmit)}
            >
              <div className="vo-modal-body">
                <section className="vo-modal-section">
                  <h3 className="vo-modal-section-title">Basics</h3>
                  <div className="vo-grid-2">
                    <div className="vo-field">
                      <label className="vo-label">Name</label>
                      <input
                        className="vo-input"
                        placeholder={ssh ? "Production bastion" : "Namecheap account"}
                        autoComplete="off"
                        {...form.register("name")}
                      />
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
                      {form.formState.errors.category && (
                        <span className="vo-field-err">{form.formState.errors.category.message}</span>
                      )}
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
                        {form.formState.errors.host && (
                          <span className="vo-field-err">{form.formState.errors.host.message}</span>
                        )}
                      </div>
                      <div className="vo-field">
                        <label className="vo-label">Port</label>
                        <input
                          className="vo-input mono"
                          type="number"
                          min={1}
                          max={65535}
                          placeholder="22"
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
                        placeholder={
                          ssh
                            ? "deploy"
                            : accessKey
                              ? "AKIA…"
                              : loginKind === "email"
                                ? "user@company.com"
                                : "your-username"
                        }
                        autoComplete="off"
                        {...form.register("username")}
                      />
                      {form.formState.errors.username && (
                        <span className="vo-field-err">{form.formState.errors.username.message}</span>
                      )}
                    </div>
                  )}

                  {ssh ? (
                    <>
                      <div className="vo-field">
                        <label className="vo-label">
                          Password <span style={{ color: "var(--fg-3)" }}>(optional with key)</span>
                        </label>
                        <div className="vo-secret-wrap">
                          <input
                            className="vo-input mono"
                            type={showPassword ? "text" : "password"}
                            placeholder="SSH account password"
                            autoComplete="new-password"
                            {...form.register("password")}
                          />
                          <button type="button" className="vo-secret-toggle" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        </div>
                        {form.formState.errors.password && (
                          <span className="vo-field-err">{form.formState.errors.password.message}</span>
                        )}
                      </div>
                      <div className="vo-field">
                        <label className="vo-label">
                          Private key <span style={{ color: "var(--fg-3)" }}>(optional with password)</span>
                        </label>
                        <textarea
                          className="vo-textarea mono"
                          rows={5}
                          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                          autoComplete="off"
                          {...form.register("secret")}
                        />
                        {form.formState.errors.secret && (
                          <span className="vo-field-err">{form.formState.errors.secret.message}</span>
                        )}
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
                            placeholder="Leave empty if key is not encrypted"
                            autoComplete="new-password"
                            {...form.register("passphrase")}
                          />
                          <button type="button" className="vo-secret-toggle" onClick={() => setShowPassphrase(!showPassphrase)}>
                            {showPassphrase ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="vo-field">
                      <label className="vo-label">{secretFieldLabel}</label>
                      <div className="vo-secret-wrap">
                        <input
                          className="vo-input mono"
                          type={showSecret ? "text" : "password"}
                          placeholder={
                            accessKey
                              ? "Secret access key"
                              : token
                                ? "Paste token…"
                                : "Paste or type the secret…"
                          }
                          autoComplete="new-password"
                          {...form.register("secret")}
                        />
                        <button type="button" className="vo-secret-toggle" onClick={() => setShowSecret(!showSecret)}>
                          {showSecret ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                      {form.formState.errors.secret && (
                        <span className="vo-field-err">{form.formState.errors.secret.message}</span>
                      )}
                    </div>
                  )}
                </section>

                <section className="vo-modal-section">
                  <h3 className="vo-modal-section-title">Details</h3>
                  <div className="vo-field">
                    <label className="vo-label">Notes <span style={{ color: "var(--fg-3)" }}>(optional, encrypted)</span></label>
                    <textarea
                      className="vo-textarea"
                      rows={3}
                      placeholder="Owner, rotation tips, context…"
                      {...form.register("notes")}
                    />
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
                    <span className="vo-muted" style={{ fontSize: 11 }}>
                      Reminder on dashboard when within 30 days.
                    </span>
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
                            accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
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
                  <span>Secrets and notes are encrypted server-side with <b>AES-256-GCM</b>. Logos are display-only.</span>
                </div>

                {error && (
                  <div style={{ fontSize: 13, color: "var(--red-400)", background: "rgba(224,70,74,0.07)", border: "1px solid rgba(224,70,74,0.2)", borderRadius: "var(--r-3)", padding: "10px 12px", marginTop: 12 }}>
                    {error}
                  </div>
                )}
              </div>

              <div className="vo-modal-actions">
                <button type="button" className="vo-btn vo-btn-ghost" onClick={close}>Cancel</button>
                <button type="submit" className="vo-btn vo-btn-webmee" disabled={form.formState.isSubmitting || logoBusy}>
                  {form.formState.isSubmitting
                    ? <><div className="vo-spinner" style={{ width: 13, height: 13, borderWidth: 1.5 }} />Saving…</>
                    : <><ShieldIcon />Save to vault</>}
                </button>
              </div>
            </form>
          </div>
        </ModalScrim>
      )}
    </>
  );
}
