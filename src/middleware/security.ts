import type { Request, Response, NextFunction } from "express";
import aj from "../config/arcjet.js";
import {ArcjetNodeRequest, slidingWindow } from "@arcjet/node";


const securityMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    if(process.env.NODE_ENV === 'test') return next();
    
    // Skip security checks for auth endpoints - they need to work without authentication
    if (req.path.startsWith('/api/auth')) {
        return next();
    }

    try {
        const role: RateLimitRole = req.user?.role ?? "guest"; // Default to "guest" if no role is found

        let limit: number;
        let message: string;

        switch (role) {
            case "admin":
                limit = 20;
                message = "Admins are limited to 2 requests per minute.";
                break;
            case "teacher":
                limit = 10;
                message = "Teachers are limited to 10 requests per minute.";
                break;
            case "student":
                limit = 10;
                message = "Students are limited to 10 requests per minute.";
                break;
            default:
                limit = 100;
                message = "Guests are limited to 5 requests per minute. Please log in for a better experience.";
        }

        const client = aj.withRule(
            slidingWindow({
                mode: "LIVE",
                interval: "1m",
                max: limit,
            })
        )

        const arcjetRequest: ArcjetNodeRequest ={
            headers: req.headers,
            method: req.method,
            url: req.originalUrl || req.url,
            socket: {remoteAddress: req.socket.remoteAddress ?? req.ip ??  '0.0.0.0'}
        }

        const decision = await client.protect(arcjetRequest);

        if (decision.isDenied() && decision.reason.isBot()) {
            return res.status(403).json({ error: "Forbidden", message: "Bot detected." });
        }

        if (decision.isDenied() && decision.reason.isShield()) {
            return res.status(403).json({ error: "Forbidden", message: "Request denied by shield." });
        }

        if (decision.isDenied() && decision.reason.isRateLimit()) {
            return res.status(429).json({ error: "Too Many Requests", message: "You have exceeded the guest limit. Please log in for a higher limit." });
        }
        next();

    } catch (error) {
        console.error("Error in Arcjet middleware: ", error);
        return res.status(500).json({ error: "Internal Server Error", message: "Something went wrong with security middleware." });
    }
}

export default securityMiddleware;