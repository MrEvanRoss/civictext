import { z } from "zod";

export const pollingLocationSchema = z.object({
  precinct: z.string().min(1, "Precinct is required"),
  locationName: z.string().min(1, "Location name is required"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "ZIP code is required"),
  pollOpenTime: z.string().optional(),
  pollCloseTime: z.string().optional(),
  notes: z.string().optional(),
});

export const bulkImportSchema = z.array(pollingLocationSchema);

export type PollingLocationInput = z.infer<typeof pollingLocationSchema>;
