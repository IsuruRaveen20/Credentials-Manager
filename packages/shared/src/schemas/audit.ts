import { z } from "zod";

export const auditActionSchema = z.enum([
  "credential.create",
  "credential.read",
  "credential.reveal",
  "credential.update",
  "credential.delete",
  "credential.rotate",
  "credential.share",
  "credential.unshare",
  "role.assign",
  "role.revoke",
  "auth.denied",
  "auth.login",
  "auth.verify",
  "auth.step_up",
  "employee.invite",
  "employee.disable",
  "security.suspicious",
]);

export type AuditAction = z.infer<typeof auditActionSchema>;
