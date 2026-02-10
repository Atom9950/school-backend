import express from "express";
import { and, desc, eq, getTableColumns, gt, ilike, or, sql } from "drizzle-orm";
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
        if (!name || !age || !gender || !admissionDate || !departmentId) {
            return res.status(400).json({
                error: 'Missing required fields: name, age, gender, admissionDate, departmentId'
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
         if (email && email !== existingStudent[0]?.email) {
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

// Get available departments for promotion (departments with higher level than current)
router.get("/:id/available-promotions", async (req, res) => {
    try {
        const { id } = req.params;

        // Check if student exists
        const studentRecord = await db
            .select()
            .from(students)
            .where(eq(students.id, Number(id)))
            .limit(1);

        if (studentRecord.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const student = studentRecord[0]!;
        const currentDeptId = student.departmentId;

        // Get current department level
        const currentDept = await db
            .select()
            .from(departments)
            .where(eq(departments.id, currentDeptId))
            .limit(1);

        if (currentDept.length === 0) {
            return res.status(404).json({ error: 'Current department not found' });
        }

        const currentLevel = currentDept[0]!.level;

        // Get all departments with higher level
        const availableDepartments = await db
            .select(getTableColumns(departments))
            .from(departments)
            .where(gt(departments.level, currentLevel))
            .orderBy(departments.level);

        res.status(200).json({
            data: availableDepartments,
            currentLevel: currentLevel,
            currentDepartmentId: currentDeptId,
        });

    } catch (e) {
        console.error(`GET /students/:id/available-promotions error: ${e}`);
        res.status(500).json({ error: 'Failed to fetch available promotions' });
    }
})

// Promote student to a new department
router.post("/:id/promote", async (req, res) => {
    try {
        const { id } = req.params;
        const { departmentId } = req.body;

        if (!departmentId) {
            return res.status(400).json({ error: 'Department ID is required' });
        }

        // Check if student exists
        const existingStudent = await db
            .select()
            .from(students)
            .where(eq(students.id, Number(id)))
            .limit(1);

        if (existingStudent.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const student = existingStudent[0]!;

        // Get current department level
        const currentDept = await db
            .select()
            .from(departments)
            .where(eq(departments.id, student.departmentId))
            .limit(1);

        if (currentDept.length === 0) {
            return res.status(404).json({ error: 'Current department not found' });
        }

        const currentLevel = currentDept[0]!.level;

        // Check if target department exists
        const targetDept = await db
            .select()
            .from(departments)
            .where(eq(departments.id, Number(departmentId)))
            .limit(1);

        if (targetDept.length === 0) {
            return res.status(404).json({ error: 'Target department not found' });
        }

        // Validate that target department has higher level
        if (targetDept[0]!.level <= currentLevel) {
            return res.status(400).json({
                error: 'Can only promote to a higher level department',
                currentLevel,
                targetLevel: targetDept[0]!.level
            });
        }

        // Update student's department
        const promotedStudent = await db
            .update(students)
            .set({
                departmentId: Number(departmentId),
                updatedAt: new Date(),
            })
            .where(eq(students.id, Number(id)))
            .returning();

        res.status(200).json({
            data: promotedStudent[0],
            message: 'Student promoted successfully'
        });

    } catch (e) {
        console.error(`POST /students/:id/promote error: ${e}`);
        res.status(500).json({ error: 'Failed to promote student' });
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
