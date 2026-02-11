import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import * as schema from "../db/schema/auth.js";

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET!,
    trustedOrigins: [
        process.env.FRONTEND_URL!,
        "https://school-frontend-flax-nine.vercel.app",
        "http://localhost:5173",
    ],
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
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
    },
});