import express from "express";
import {and, desc, eq, getTableColumns, ilike, or, sql} from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import {user} from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

// Get all users with optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, role, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100); // Max 100 records per page

        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        // If search query exists, filter by user name OR user email
        if (search) {
            filterConditions.push(
                or(
                    ilike(user.name, `%${search}%`),
                    ilike(user.email, `%${search}%`)
                )
            );
        }

        // If role filter exists, match exact role
        if (role) {
            filterConditions.push(eq(user.role, role as any));
        }

        // Combine all filters using AND if any exist
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)`})
            .from(user)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const usersList = await db
            .select({
                ...getTableColumns(user),
            }).from(user)
            .where(whereClause)
            .orderBy(desc(user.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: usersList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        })

    } catch (e) {
        console.error(`GET /users error: ${e}`);
        res.status(500).json({ error: 'Failed to get users' });
    }
})

// Get a single user by ID
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const userRecord = await db
            .select({
                ...getTableColumns(user),
            })
            .from(user)
            .where(eq(user.id, id))
            .limit(1);

        if (userRecord.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            data: userRecord[0]
        });
    } catch (e) {
        console.error(`GET /users/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to get user' });
    }
})

// Create a new user
router.post("/", async (req, res) => {
    try {
        const { name, email, role = "teacher", image, imageCldPubId } = req.body;

        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({ 
                error: "Missing required fields: name, email" 
            });
        }

        // Check if email already exists
        const existingUser = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, email))
            .limit(1);

        if (existingUser.length > 0) {
            return res.status(400).json({ error: "Email already exists" });
        }

        // Create the user
        const userId = uuidv4();
        const result = await db.insert(user)
            .values({
                id: userId,
                name,
                email,
                role: role as any,
                emailVerified: false,
                image: image || null,
                imageCldPubId: imageCldPubId || null,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning();

        res.status(201).json({
            data: result[0],
            message: "User created successfully"
        });
    } catch (error) {
        console.error(`POST /users error: ${error}`);
        res.status(500).json({ error: "Failed to create user" });
    }
})

export default router;