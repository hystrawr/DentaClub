import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, get, post } from "./client";

// Sign in and out. The session itself is an httpOnly cookie the API sets;
// page scripts never see it.

/** admin: everything, including Settings. staff: Dashboard, Appointments and Patients. */
export type UserRole = "admin" | "staff";

export interface CurrentUser {
  username: string;
  role: UserRole;
}

/** Who is signed in. `null` when nobody is (a 401 is an answer, not an error). */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      try {
        return (await get<{ data: CurrentUser }>("/api/auth/me")).data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useSignIn() {
  return useMutation({
    mutationFn: async (input: { username: string; password: string }) =>
      (await post<{ data: CurrentUser }>("/api/auth/login", input)).data,
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<void>("/api/auth/logout"),
    // Forget every patient record this browser had loaded.
    onSuccess: () => qc.clear(),
  });
}

/**
 * True only once the signed-in user is known to be an admin. Hiding a page
 * with this is a convenience; the API refuses staff on its own.
 */
export function useIsAdmin(): boolean {
  return useCurrentUser().data?.role === "admin";
}
