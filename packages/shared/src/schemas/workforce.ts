import { z } from "zod";

export const inviteEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  role: z.enum(["owner", "admin", "editor", "viewer", "auditor"]),
});

export const setEmployeeRoleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer", "auditor"]),
});

export const setPasswordSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(10).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
});

export const stepUpSchema = z.object({
  password: z.string().min(1).max(128),
});

export const shareCredentialSchema = z.object({
  userId: z.string().uuid(),
});

export type InviteEmployeeInput = z.infer<typeof inviteEmployeeSchema>;
export type SetEmployeeRoleInput = z.infer<typeof setEmployeeRoleSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type StepUpInput = z.infer<typeof stepUpSchema>;
export type ShareCredentialInput = z.infer<typeof shareCredentialSchema>;
