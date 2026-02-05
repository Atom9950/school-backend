type userRole = "admin" | "teacher" | "student";

type RateLimitRole = userRole | "guest"; // Add "guest" for unauthenticated users