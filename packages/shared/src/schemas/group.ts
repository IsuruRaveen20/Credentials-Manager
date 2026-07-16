import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  /** Hex color or named swatch id used for the group's badge. */
  color: z.string().max(20).optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(300).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
});

export const groupMemberSchema = z.object({
  userId: z.string().uuid(),
});

export const shareCredentialWithGroupSchema = z.object({
  groupId: z.string().uuid(),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type GroupMemberInput = z.infer<typeof groupMemberSchema>;
export type ShareCredentialWithGroupInput = z.infer<typeof shareCredentialWithGroupSchema>;
