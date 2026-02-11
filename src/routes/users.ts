import express from "express";
import {and, desc, eq, getTableColumns, ilike, or, sql} from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import {user, classes, departments, teacherDepartments, teacherClasses} from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

// Get all users with optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, role, department, page = 1, limit = 10 } = req.query;

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

        let usersList;
        let totalCount = 0;

        // If department filter exists, join with teacherDepartments and filter
        if (department) {
            const departmentId = parseInt(String(department), 10);
            
            const countResult = await db
                .select({ count: sql<number>`count(distinct ${user.id})`})
                .from(user)
                .innerJoin(teacherDepartments, eq(user.id, teacherDepartments.teacherId))
                .where(
                    whereClause 
                        ? and(whereClause, eq(teacherDepartments.departmentId, departmentId))
                        : eq(teacherDepartments.departmentId, departmentId)
                );

            totalCount = countResult[0]?.count ?? 0;

            usersList = await db
                .select({
                    ...getTableColumns(user),
                }).from(user)
                .innerJoin(teacherDepartments, eq(user.id, teacherDepartments.teacherId))
                .where(
                    whereClause 
                        ? and(whereClause, eq(teacherDepartments.departmentId, departmentId))
                        : eq(teacherDepartments.departmentId, departmentId)
                )
                .orderBy(desc(user.createdAt))
                .limit(limitPerPage)
                .offset(offset);
        } else {
            const countResult = await db
                .select({ count: sql<number>`count(*)`})
                .from(user)
                .where(whereClause);

            totalCount = countResult[0]?.count ?? 0;

            usersList = await db
                .select({
                    ...getTableColumns(user),
                }).from(user)
                .where(whereClause)
                .orderBy(desc(user.createdAt))
                .limit(limitPerPage)
                .offset(offset);
        }

        // For teachers, fetch their allocated departments
        const usersWithDepartments = await Promise.all(
            usersList.map(async (u) => {
                if (u.role === 'teacher') {
                    const allocatedDepartments = await db
                        .select({
                            ...getTableColumns(departments),
                        })
                        .from(departments)
                        .innerJoin(teacherDepartments, eq(departments.id, teacherDepartments.departmentId))
                        .where(eq(teacherDepartments.teacherId, u.id));
                    
                    return {
                        ...u,
                        departments: allocatedDepartments
                    };
                }
                return u;
            })
        );

        res.status(200).json({
            data: usersWithDepartments,
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

        const userData = userRecord[0]!;
        let allocatedDepartments: typeof departments.$inferSelect[] = [];
        let allocatedClasses: typeof classes.$inferSelect[] = [];

        // If user is a teacher, fetch allocated departments and classes
        if (userData.role === 'teacher') {
            allocatedDepartments = await db
                .select({
                    ...getTableColumns(departments),
                })
                .from(departments)
                .innerJoin(teacherDepartments, eq(departments.id, teacherDepartments.departmentId))
                .where(eq(teacherDepartments.teacherId, id));

            allocatedClasses = await db
                .select({
                    ...getTableColumns(classes),
                })
                .from(classes)
                .innerJoin(teacherClasses, eq(classes.id, teacherClasses.classId))
                .where(eq(teacherClasses.teacherId, id));
        }

        res.status(200).json({
            data: {
                ...userRecord[0],
                departments: allocatedDepartments,
                classes: allocatedClasses
            }
        });
    } catch (e) {
        console.error(`GET /users/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to get user' });
    }
})

// Create a new user
router.post("/", async (req, res) => {
    try {
        const { 
            name, 
            email, 
            role = "teacher", 
            image, 
            imageCldPubId,
            address,
            age,
            gender,
            joiningDate,
            bannerUrl,
            bannerCldPubId,
            bio,
            phoneNumber,
            allocatedDepartments,
            allocatedClasses
        } = req.body;

        console.log("POST /users request body:", req.body);

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
                image: bannerUrl || image || null,
                imageCldPubId: bannerCldPubId || imageCldPubId || null,
                address: address || null,
                age: age ? age.toString() : null,
                gender: gender || null,
                joiningDate: joiningDate ? new Date(joiningDate) : null,
                bio: bio || null,
                phoneNumber: phoneNumber || null,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning();

        // If role is teacher and departments/classes are allocated, create the relationships
        if (role === "teacher") {
            // Add allocated departments
            if (allocatedDepartments && Array.isArray(allocatedDepartments) && allocatedDepartments.length > 0) {
                const departmentIds = await db
                    .select({ id: departments.id })
                    .from(departments)
                    .where(or(...allocatedDepartments.map(deptName => eq(departments.name, deptName))));

                if (departmentIds.length > 0) {
                    await db.insert(teacherDepartments)
                        .values(departmentIds.map(dept => ({
                            teacherId: userId,
                            departmentId: dept.id
                        })));
                }
            }

            // Add allocated classes
            if (allocatedClasses && Array.isArray(allocatedClasses) && allocatedClasses.length > 0) {
                await db.insert(teacherClasses)
                    .values(allocatedClasses.map(classId => ({
                        teacherId: userId,
                        classId: classId
                    })));
            }
        }

        res.status(201).json({
            data: result[0],
            message: "User created successfully"
        });
    } catch (error) {
        console.error(`POST /users error: ${error}`);
        res.status(500).json({ error: "Failed to create user" });
    }
})

// Update a user
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, 
            email, 
            address,
            age,
            gender,
            joiningDate,
            bannerUrl,
            bannerCldPubId,
            bio,
            phoneNumber
        } = req.body;

        // Check if user exists
        const userRecord = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, id))
            .limit(1);

        if (userRecord.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update the user
        const result = await db
            .update(user)
            .set({
                ...(name && { name }),
                ...(email && { email }),
                ...(address && { address }),
                ...(age && { age: age.toString() }),
                ...(gender && { gender }),
                ...(joiningDate && { joiningDate: new Date(joiningDate) }),
                ...(bannerUrl && { image: bannerUrl }),
                ...(bannerCldPubId && { imageCldPubId: bannerCldPubId }),
                ...(bio !== undefined && { bio: bio || null }),
                ...(phoneNumber !== undefined && { phoneNumber: phoneNumber || null }),
                updatedAt: new Date()
            })
            .where(eq(user.id, id))
            .returning();

        res.status(200).json({
            data: result[0],
            message: "User updated successfully"
        });
    } catch (error) {
        console.error(`PUT /users/:id error: ${error}`);
        res.status(500).json({ error: "Failed to update user" });
    }
})

// Delete a user
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const userRecord = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, id))
            .limit(1);

        if (userRecord.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete the user (classes will be unassigned via CASCADE SET NULL)
        await db.delete(user).where(eq(user.id, id));

        res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        console.error(`DELETE /users/:id error: ${error}`);
        res.status(500).json({ error: "Failed to delete user" });
    }
})

export default router;