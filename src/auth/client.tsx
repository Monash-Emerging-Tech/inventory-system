import { getBaseUrl } from "@/lib/utils";
import { createAuthClient } from "better-auth/react";
import { adminClient, customSessionClient } from "better-auth/client/plugins";
import type { auth } from "@/server/auth";

export const authClient = createAuthClient({
  plugins: [adminClient(), customSessionClient<typeof auth>()],
  baseURL: getBaseUrl(),
});
