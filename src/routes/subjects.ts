import { and, count, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";
import { departments, subjects, classes, enrollments } from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router()

//Get all subjects with optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const {search, department, page = 1, limit = 10} = req.query;

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10),100); // Max 100 records per page


        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        //If search query is provided, filter by subject name or subject code
        if (search) {
            filterConditions.push(
                or(
                    ilike(subjects.name, `%${search}%`),
                    ilike(subjects.code, `%${search}%`)
                )
            );
        }

        //If departmentId is provided, filter by departmentId
        if (department) {
            const departmentId = parseInt(String(department), 10);
            if (!isNaN(departmentId)) {
                filterConditions.push(eq(subjects.departmentId, departmentId));
            }
        }

        //combine all filter conditions using AND
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db.select({count: sql<number>`count(distinct ${subjects.id})`})
            .from(subjects)
            .leftJoin(departments, eq(subjects.departmentId, departments.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const subjectList = await db.select({
            ...getTableColumns(subjects), 
            department: 
            {
                ...getTableColumns
                (
                    departments
                )
            }
        }).from(subjects).leftJoin(departments, eq(subjects.departmentId, departments.id))
        .where(whereClause)
        .orderBy(desc(subjects.createdAt))
        .limit(limitPerPage)
        .offset(offset);

        res.status(200).json({
            data: subjectList,
            page: currentPage,
            limit: limitPerPage,
            total: totalCount,
            totalPages: Math.ceil(totalCount/limitPerPage)
        })
    } catch (error) {
        console.error(`GET /subjects error: ${error}`);
        res.status(500).json({ error: "Failed to fetch subjects" });
    }
})

// Create a new subject
router.post("/", async (req, res) => {
    try {
        const { name, code, description, department } = req.body;

        // Validate required fields
        if (!name || !code || !description || !department) {
            return res.status(400).json({ 
                error: "Missing required fields: name, code, description, department" 
            });
        }

        // Get the department by name to get its ID
        const deptResult = await db.select({id: departments.id})
            .from(departments)
            .where(ilike(departments.name, String(department)))
            .limit(1);

        if (deptResult.length === 0) {
            return res.status(404).json({ error: "Department not found" });
        }

        const departmentId = deptResult[0]?.id;
        if (!departmentId) {
            return res.status(404).json({ error: "Department not found" });
        }

        // Create the subject
        const result = await db.insert(subjects)
            .values({
                name,
                code,
                description,
                departmentId,
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning();

        res.status(201).json({
            data: result[0],
            message: "Subject created successfully"
        });
    } catch (error) {
        console.error(`POST /subjects error: ${error}`);
        res.status(500).json({ error: "Failed to create subject" });
    }
})

// Delete a subject
router.delete("/:id", async (req, res) => {
    try {
        const subjectId = Number(req.params.id);

        if (!Number.isFinite(subjectId)) {
            return res.status(400).json({ error: "Invalid subject ID" });
        }

        // Get all classes in this subject
        const subjectClasses = await db
            .select({ id: classes.id })
            .from(classes)
            .where(eq(classes.subjectId, subjectId));

        // Delete enrollments for each class
        for (const classRecord of subjectClasses) {
            await db
                .delete(enrollments)
                .where(eq(enrollments.classId, classRecord.id));
        }

        // Delete classes
        await db
            .delete(classes)
            .where(eq(classes.subjectId, subjectId));

        // Delete the subject
        const result = await db
            .delete(subjects)
            .where(eq(subjects.id, subjectId))
            .returning();

        if (result.length === 0) {
            return res.status(404).json({ error: "Subject not found" });
        }

        res.status(200).json({
            data: result[0],
            message: "Subject deleted successfully",
        });
    } catch (error) {
        console.error(`DELETE /subjects/:id error: ${error}`);
        res.status(500).json({ error: "Failed to delete subject" });
    }
})

export default router;
