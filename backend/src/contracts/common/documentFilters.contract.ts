import { z } from "zod";

import { documentStatusSchema } from "./enums.contract";

/** Filters shared by receipt and issue list endpoints; deliberately no paging. */
export const documentFiltersSchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    status: documentStatusSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.from > value.to) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "to must be on or after from",
      });
    }
  });

export type DocumentFilters = z.infer<typeof documentFiltersSchema>;
