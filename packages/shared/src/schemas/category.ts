import { z } from "zod";
import { credentialCategorySchema } from "./credential";

export const createCategorySchema = z.object({
  name: credentialCategorySchema,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
