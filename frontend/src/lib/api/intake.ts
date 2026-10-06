import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, get, post } from "./client";
import type { IntakePortalPacket, IntakeSubmitPayload } from "@/types/api";

// The patient side of consent & intake, ported from DentalOS lib/api/intake.ts.
// The link itself is the credential here (no patient login), so the routes are
// /api/public/intake/:token.

/**
 * The token goes into the path percent-encoded. It is standard base64, so
 * roughly one in three contains a `/` — a path separator, not a character —
 * which would route the request somewhere that does not exist.
 */
const path = (token: string) => `/api/public/intake/${encodeURIComponent(token)}`;

/**
 * The packet to fill in.
 *
 * Unwrapped from `{ data }`. (DentalOS's hook did not unwrap it, so its page read
 * `packet.packet` off the envelope and never received a real form.)
 */
export function useIntakePacket(token: string | undefined) {
  return useQuery({
    queryKey: ["intake", token],
    queryFn: async () => (await get<{ data: IntakePortalPacket }>(path(token ?? ""))).data,
    enabled: Boolean(token),
    retry: false, // an invalid or used token stays invalid
    staleTime: Infinity, // the packet does not change mid-visit
  });
}

/**
 * Finish an intake packet.
 *
 * The API splits this in two: `POST {token}/submit` saves the answers, and
 * `POST {token}/sign` finalises them into an immutable signed document. They
 * stay behind one mutation because, from the patient's side, the form
 * completes in one action.
 */
export function useSubmitIntake(token: string) {
  return useMutation({
    mutationFn: async ({ responses, signature }: IntakeSubmitPayload) => {
      const saved = await post<{ data: unknown }>(`${path(token)}/submit`, { responses });
      if (!signature) return saved;
      return post<{ data: unknown }>(`${path(token)}/sign`, { signature_data_uri: signature });
    },
  });
}

/** The API's exact words for a link that has already been used. */
const ALREADY_COMPLETED = "This intake link has already been completed.";

/**
 * True when the refusal means "you have already done this" rather than "this
 * link is not valid". Both are 401, so they are told apart by the message —
 * one is nothing to do, the other is a reason to call the clinic.
 */
export function isAlreadyCompleted(error: unknown): boolean {
  return error instanceof ApiError && error.message === ALREADY_COMPLETED;
}
