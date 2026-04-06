// backend/src/middleware/validation.ts
import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";

export const urlSchema = z.object({
  originalUrl: z
    .string()
    .url("Must be a valid URL")
    .max(2048, "URL too long")
    .refine((u) => /^https?:\/\//i.test(u), "Must start with http:// or https://"),
  customCode: z
    .string()
    .min(4, "Min 4 chars")
    .max(20, "Max 20 chars")
    .regex(/^[a-zA-Z0-9_-]+$/, "Only alphanumeric, dash, underscore")
    .optional(),
  expiresAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .refine(
      (d) => !d || new Date(d) > new Date(),
      "Expiry must be in the future"
    ),
  title: z.string().max(200).optional(),
  customDomain: z.string().max(253).optional(),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z
    .string()
    .min(8, "Min 8 chars")
    .regex(/[A-Z]/, "Needs uppercase")
    .regex(/[0-9]/, "Needs number")
    .regex(/[^A-Za-z0-9]/, "Needs special char"),
  name: z.string().min(2).max(80).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: "Please enter a valid password",
        details: result.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
