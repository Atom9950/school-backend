import express from "express";
import { eq, getTableColumns, sql, and } from "drizzle-orm";
import {
    departments,
    subjects,
    classes,
    enrollments,
    teacherDepartments,
} from "../db/schema/index.js";
import { user } from "../db/schema/index.js";
import { db } from "../db/index.js";
import {
    extractLevelFromDepartmentName,
    getValidDepartmentLevels,
} from "../lib/level-extractor.js";

const router = express.Router();

// Get valid department levels reference
router.get("/levels/reference", (req, res) => {
    const levels = getValidDepartmentLevels();
    res.status(200).json({
        data: levels,
        message: "Valid department levels and their names",
    });
});

// Get all departments with pagination
router.get("/", async (req, res) => {
    try {
        const { page = 1, limit = 10, teacher } = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(
            Math.max(1, parseInt(String(limit), 10) || 10),
            100,
        );
        const offset = (currentPage - 1) * limitPerPage;

        // Build the query based on whether teacher filter exists
        let departmentList: any[];
        let totalCount = 0;

        if (teacher) {
            const teacherId = String(teacher);

            // Count query with teacher filter
            const countResult = await db
                .select({ count: sql<number>`count(distinct ${departments.id})` })
                .from(departments)
                .innerJoin(
                    teacherDepartments,
                    eq(departments.id, teacherDepartments.departmentId),
                )
                .where(eq(teacherDepartments.teacherId, teacherId));

            totalCount = countResult[0]?.count ?? 0;

            // Data query with teacher filter
            departmentList = await db
                .select({
                    ...getTableColumns(departments),
                    headTeacher: getTableColumns(user),
                })
                .from(departments)
                .innerJoin(
                    teacherDepartments,
                    eq(departments.id, teacherDepartments.departmentId),
                )
                .leftJoin(user, eq(departments.headTeacherId, user.id))
                .where(eq(teacherDepartments.teacherId, teacherId))
                .limit(limitPerPage)
                .offset(offset);
        } else {
            // Count query without filter
            const countResult = await db
                .select({ count: sql<number>`count(*)` })
                .from(departments);

            totalCount = countResult[0]?.count ?? 0;

            // Data query without filter
            departmentList = await db
                .select({
                    ...getTableColumns(departments),
                    headTeacher: getTableColumns(user),
                })
                .from(departments)
                .leftJoin(user, eq(departments.headTeacherId, user.id))
                .limit(limitPerPage)
                .offset(offset);
        }

        res.status(200).json({
            data: departmentList,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            },
        });
    } catch (error) {
        console.error(`GET /departments error: ${error}`);
        res.status(500).json({ error: "Failed to fetch departments" });
    }
});

// Get department by ID
router.get("/:id", async (req, res) => {
    try {
        const departmentId = Number(req.params.id);

        if (!Number.isFinite(departmentId)) {
            return res.status(400).json({ error: "Invalid department ID" });
        }

        const [department] = await db
            .select({
                ...getTableColumns(departments),
                headTeacher: getTableColumns(user),
            })
            .from(departments)
            .leftJoin(user, eq(departments.headTeacherId, user.id))
            .where(eq(departments.id, departmentId));

        if (!department) {
            return res.status(404).json({ error: "Department not found" });
        }

        // Fetch all teachers allocated to this department
        const teachers = await db
            .select(getTableColumns(user))
            .from(user)
            .innerJoin(teacherDepartments, eq(user.id, teacherDepartments.teacherId))
            .where(eq(teacherDepartments.departmentId, departmentId));

        res.status(200).json({ data: { ...department, teachers } });
    } catch (error) {
        console.error(`GET /departments/:id error: ${error}`);
        res.status(500).json({ error: "Failed to fetch department" });
    }
});

// Create a new department
router.post("/", async (req, res) => {
    try {
        const { name, description, bannerUrl, bannerCldPubId, headTeacherId } =
            req.body;

        if (!name) {
            return res.status(400).json({ error: "Department name is required" });
        }

        if (!description) {
            return res
                .status(400)
                .json({ error: "Department description is required" });
        }

        if (!bannerUrl || !bannerCldPubId) {
            return res.status(400).json({ error: "Department banner is required" });
        }

        if (!headTeacherId) {
            return res
                .status(400)
                .json({ error: "Department head teacher is required" });
        }

        // Generate a unique code from department name
        const code = name.toUpperCase().replace(/\s+/g, "_").substring(0, 50);

        // Auto-extract level from department name
        const level = extractLevelFromDepartmentName(name);
        if (level === null) {
            return res.status(400).json({
                error:
                    "Department name must be in format: Lower Nursery, Upper Nursery, KG-1, KG-2, Class 1-12, or with sections (e.g., Class 8A, Class 8B)",
            });
        }

        const result = await db
            .insert(departments)
            .values({
                code,
                name,
                description,
                bannerUrl,
                bannerCldPubId,
                headTeacherId,
                level,
            })
            .returning();

        const resultArray = Array.isArray(result) ? result : [result];
        res.status(201).json({
            data: resultArray.length > 0 ? resultArray[0] : null,
            message: "Department created successfully",
        });
    } catch (error) {
        console.error(`POST /departments error: ${error}`);
        res.status(500).json({ error: "Failed to create department" });
    }
});

// Update a department (PUT)
router.put("/:id", async (req, res) => {
    try {
        const departmentId = Number(req.params.id);

        if (!Number.isFinite(departmentId)) {
            return res.status(400).json({ error: "Invalid department ID" });
        }

        const { name, description, bannerUrl, bannerCldPubId, headTeacherId } =
            req.body;

        if (!name) {
            return res.status(400).json({ error: "Department name is required" });
        }

        if (!description) {
            return res
                .status(400)
                .json({ error: "Department description is required" });
        }

        if (!bannerUrl || !bannerCldPubId) {
            return res.status(400).json({ error: "Department banner is required" });
        }

        if (!headTeacherId) {
            return res
                .status(400)
                .json({ error: "Department head teacher is required" });
        }

        // Auto-extract level from department name
        const level = extractLevelFromDepartmentName(name);
        if (level === null) {
            return res.status(400).json({
                error:
                    "Department name must be in format: Lower Nursery, Upper Nursery, KG-1, KG-2, Class 1-12, or with sections (e.g., Class 8A, Class 8B)",
            });
        }

        const result = await db
            .update(departments)
            .set({
                name,
                description,
                bannerUrl,
                bannerCldPubId,
                headTeacherId,
                level,
            })
            .where(eq(departments.id, departmentId))
            .returning();

        const resultArray = Array.isArray(result) ? result : [result];
        if (resultArray.length === 0) {
            return res.status(404).json({ error: "Department not found" });
        }

        res.status(200).json({
            data: resultArray[0],
            message: "Department updated successfully",
        });
    } catch (error) {
        console.error(`PUT /departments/:id error: ${error}`);
        res.status(500).json({ error: "Failed to update department" });
    }
});

// Update a department (PATCH)
router.patch("/:id", async (req, res) => {
    try {
        const departmentId = Number(req.params.id);

        if (!Number.isFinite(departmentId)) {
            return res.status(400).json({ error: "Invalid department ID" });
        }

        const { name, description, bannerUrl, bannerCldPubId, headTeacherId } =
            req.body;

        if (!name) {
            return res.status(400).json({ error: "Department name is required" });
        }

        if (!description) {
            return res
                .status(400)
                .json({ error: "Department description is required" });
        }

        if (!bannerUrl || !bannerCldPubId) {
            return res.status(400).json({ error: "Department banner is required" });
        }

        if (!headTeacherId) {
            return res
                .status(400)
                .json({ error: "Department head teacher is required" });
        }

        // Auto-extract level from department name
        const level = extractLevelFromDepartmentName(name);
        if (level === null) {
            return res.status(400).json({
                error:
                    "Department name must be in format: Lower Nursery, Upper Nursery, KG-1, KG-2, Class 1-12, or with sections (e.g., Class 8A, Class 8B)",
            });
        }

        const result = await db
            .update(departments)
            .set({
                name,
                description,
                bannerUrl,
                bannerCldPubId,
                headTeacherId,
                level,
            })
            .where(eq(departments.id, departmentId))
            .returning();

        const resultArray = Array.isArray(result) ? result : [result];
        if (resultArray.length === 0) {
            return res.status(404).json({ error: "Department not found" });
        }

        res.status(200).json({
            data: resultArray[0],
            message: "Department updated successfully",
        });
    } catch (error) {
        console.error(`PATCH /departments/:id error: ${error}`);
        res.status(500).json({ error: "Failed to update department" });
    }
});

// Delete a department
router.delete("/:id", async (req, res) => {
    try {
        const departmentId = Number(req.params.id);

        if (!Number.isFinite(departmentId)) {
            return res.status(400).json({ error: "Invalid department ID" });
        }

        // Get all subjects in this department
        const departmentSubjects = await db
            .select({ id: subjects.id })
            .from(subjects)
            .where(eq(subjects.departmentId, departmentId));

        // Delete enrollments and classes for each subject
        for (const subject of departmentSubjects) {
            // Delete enrollments for classes in this subject
            const subjectClasses = await db
                .select({ id: classes.id })
                .from(classes)
                .where(eq(classes.subjectId, subject.id));

            for (const classRecord of subjectClasses) {
                await db
                    .delete(enrollments)
                    .where(eq(enrollments.classId, classRecord.id));
            }

            // Delete classes
            await db.delete(classes).where(eq(classes.subjectId, subject.id));
        }

        // Delete subjects
        await db.delete(subjects).where(eq(subjects.departmentId, departmentId));

        // Delete the department
        const result = await db
            .delete(departments)
            .where(eq(departments.id, departmentId))
            .returning();

        const resultArray = Array.isArray(result) ? result : [result];
        if (resultArray.length === 0) {
            return res.status(404).json({ error: "Department not found" });
        }

        res.status(200).json({
            data: resultArray[0],
            message: "Department deleted successfully",
        });
    } catch (error) {
        console.error(`DELETE /departments/:id error: ${error}`);
        res.status(500).json({ error: "Failed to delete department" });
    }
});

export default router;
