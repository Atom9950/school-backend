import { and, count, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import express from "express";
import { departments, subjects } from "../db/schema";
import { db } from "../db";

const router = express.Router()

//Get all subjects with optional search, filtering and pagination
router.get("/", async (req, res) => {
    try {
        const {search, department, page = 1, limit = 10} = req.query;

        const currentPage = Math.max(1, +page);
        const limitPerPage = Math.max(1, +limit);

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
            filterConditions.push(ilike(departments.name, `%${department}%`));
        }

        //combine all filter conditions using AND
        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db.select({count: sql<number>`count(*)`})
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

export default router;
