"use client";

import Link from "next/link";
import {
  formatRoleLabel,
  ROLE_CAPABILITIES,
  ROLE_GUIDES,
  roleHasCapability,
} from "@/lib/roles";

function CanIcon() {
  return (
    <span className="vo-role-can" title="Allowed" aria-label="Allowed">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}

function CantIcon() {
  return (
    <span className="vo-role-cant" title="Not allowed" aria-label="Not allowed">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </span>
  );
}

export default function RolesPage() {
  return (
    <div>
      <div className="vo-page-head">
        <div>
          <h1 className="vo-page-title">Roles</h1>
          <p className="vo-page-sub">
            What each role can and cannot do. Assign roles from{" "}
            <Link href="/employees" style={{ color: "var(--brand)" }}>Employees</Link>.
          </p>
        </div>
      </div>

      <div className="vo-table-wrap" style={{ marginBottom: 20 }}>
        <table className="vo-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_GUIDES.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="vo-role-badge">{formatRoleLabel(r.id)}</span>
                </td>
                <td style={{ color: "var(--fg-2)", maxWidth: 520 }}>{r.description}</td>
              </tr>
            ))}
            <tr>
              <td>
                <span className="vo-role-badge vo-role-badge--owner">Owner</span>
              </td>
              <td style={{ color: "var(--fg-2)", maxWidth: 520 }}>
                Organization owner — same full permissions as Admin. Cannot be reassigned from the Employees table.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="vo-section-title" style={{ marginBottom: 10 }}>Permission matrix</h2>
      <p className="vo-muted" style={{ marginBottom: 14, fontSize: 13 }}>
        <CanIcon /> Allowed &nbsp;&nbsp; <CantIcon /> Not allowed
      </p>

      <div className="vo-table-wrap vo-table-wrap--scroll">
        <table className="vo-table vo-role-matrix">
          <thead>
            <tr>
              <th>Capability</th>
              {ROLE_GUIDES.map((r) => (
                <th key={r.id} className="vo-role-matrix-role">
                  {formatRoleLabel(r.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_CAPABILITIES.map((cap) => (
              <tr key={cap.id}>
                <td>{cap.label}</td>
                {ROLE_GUIDES.map((r) => {
                  const allowed = roleHasCapability(r.id, cap.id);
                  return (
                    <td key={r.id} className="vo-role-matrix-cell">
                      {allowed ? <CanIcon /> : <CantIcon />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
