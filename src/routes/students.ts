import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { students, departments } from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

// Get all students with optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const { search, department, page = 1, limit = 10 } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);

        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        // If search query exists, filter by student name OR email
        if (search) {
            filterConditions.push(
                or(
                    ilike(students.name, `%${search}%`),
                    ilike(students.email, `%${search}%`)
                )
            );
        }

        // If department filter exists, match exact department
        if (department) {
            filterConditions.push(
                or(
                    eq(departments.name, String(department))
                )
            );
        }

        // Combine all filters using AND if any exist
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(students)
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const studentsList = await db
            .select({
                ...getTableColumns(students),
                department: {
                    id: departments.id,
                    name: departments.name,
                },
            })
            .from(students)
            .leftJoin(departments, eq(students.departmentId, departments.id))
            .where(whereClause)
            .orderBy(desc(students.createdAt))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: studentsList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        })

    } catch (e) {
        console.error(`GET /students error: ${e}`);
        res.status(500).json({ error: 'Failed to get students' });
    }
})

// Get a single student by ID
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const studentRecord = await db
            .select({
                ...getTableColumns(students),
                department: {
                    id: departments.id,
                    name: departments.name,
                },
            })
            .from(students)
            .leftJoin(departments, eq(students.departmentId, departments.id))
            .where(eq(students.id, Number(id)))
            .limit(1);

        if (studentRecord.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        res.status(200).json({ data: studentRecord[0] });

    } catch (e) {
        console.error(`GET /students/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to get student' });
    }
})

// Create a new student
router.post("/", async (req, res) => {
    try {
        const {
            name,
            email,
            age,
            gender,
            fathersName,
            mothersName,
            address,
            phoneNumber,
            whatsappNumber,
            admissionDate,
            departmentId,
            rollNumber,
            image,
            imageCldPubId,
        } = req.body;

        // Validate required fields
        if (!name || !email || !age || !gender || !admissionDate || !departmentId) {
            return res.status(400).json({
                error: 'Missing required fields: name, email, age, gender, admissionDate, departmentId'
            });
        }

        // Check if email already exists
        const existingStudent = await db
            .select()
            .from(students)
            .where(eq(students.email, email))
            .limit(1);

        if (existingStudent.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Create new student
        const newStudent = await db
            .insert(students)
            .values({
                name,
                email,
                age: Number(age),
                gender,
                fathersName,
                mothersName,
                address,
                phoneNumber,
                whatsappNumber,
                admissionDate: new Date(admissionDate),
                departmentId: Number(departmentId),
                rollNumber,
                image,
                imageCldPubId,
            })
            .returning();

        res.status(201).json({
            data: newStudent[0]
        });

    } catch (e) {
        console.error(`POST /students error: ${e}`);
        res.status(500).json({ error: 'Failed to create student' });
    }
})

// Update a student
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            email,
            age,
            gender,
            fathersName,
            mothersName,
            address,
            phoneNumber,
            whatsappNumber,
            admissionDate,
            departmentId,
            rollNumber,
            image,
            imageCldPubId,
        } = req.body;

        // Check if student exists
        const existingStudent = await db
            .select()
            .from(students)
            .where(eq(students.id, Number(id)))
            .limit(1);

        if (existingStudent.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Check if new email already exists (and it's different from current email)
        if (email && email !== existingStudent[0].email) {
            const emailExists = await db
                .select()
                .from(students)
                .where(eq(students.email, email))
                .limit(1);

            if (emailExists.length > 0) {
                return res.status(400).json({ error: 'Email already exists' });
            }
        }

        // Update student
        const updatedStudent = await db
            .update(students)
            .set({
                name,
                email,
                age: age ? Number(age) : undefined,
                gender,
                fathersName,
                mothersName,
                address,
                phoneNumber,
                whatsappNumber,
                admissionDate: admissionDate ? new Date(admissionDate) : undefined,
                departmentId: departmentId ? Number(departmentId) : undefined,
                rollNumber,
                image,
                imageCldPubId,
                updatedAt: new Date(),
            })
            .where(eq(students.id, Number(id)))
            .returning();

        res.status(200).json({
            data: updatedStudent[0]
        });

    } catch (e) {
        console.error(`PUT /students/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to update student' });
    }
})

// Delete a student
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Check if student exists
        const existingStudent = await db
            .select()
            .from(students)
            .where(eq(students.id, Number(id)))
            .limit(1);

        if (existingStudent.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Delete student
        await db
            .delete(students)
            .where(eq(students.id, Number(id)));

        res.status(200).json({
            message: 'Student deleted successfully'
        });

    } catch (e) {
        console.error(`DELETE /students/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to delete student' });
    }
})

export default router;
