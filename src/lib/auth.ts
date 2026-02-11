import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from "../db/schema/auth.js";

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    trustedOrigins: [process.env.FRONTEND_URL!],
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: schema.adminUser,
            session: schema.adminSession,
            account: schema.adminAccount,
            verification: schema.adminVerification,
        },
    }),
    emailAndPassword: {
        enabled: true,
    },
    session: {
        expiresIn: 60 * 60 * 24 * 7,  // 7 days in seconds
        updateAge: 60 * 60 * 24,  // refresh session every 1 day
        rememberMe: 60 * 60 * 24 * 30,  // 30 days if rememberMe checked
    },
    // Disable cookies for cross-domain, rely on JWT in response
    disableCsrfCheck: true,
    useSecureCookies: false,
    trustHost: true,
});