import express from "express";
import { and, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import { attendance, classes, students } from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

// Get all attendance records with filters and pagination
router.get("/", async (req, res) => {
    try {
        const { classId, studentId, date, status, departmentId, search, rollNumber, page = 1, limit = 10 } = req.query;

        console.log("Attendance GET params:", { classId, studentId, date, status, departmentId, search, rollNumber, page, limit });

        const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
        const limitPerPage = Math.min(Math.max(1, parseInt(String(limit), 10) || 10), 100);
        const offset = (currentPage - 1) * limitPerPage;

        const filterConditions = [];

        if (classId) {
            console.log("Adding classId filter:", classId);
            filterConditions.push(eq(attendance.classId, Number(classId)));
        }

        if (studentId) {
            console.log("Adding studentId filter:", studentId);
            filterConditions.push(eq(attendance.studentId, Number(studentId)));
        }

        if (date) {
            console.log("Adding date filter:", date);
            const dateStr = String(date);
            // Parse date as YYYY-MM-DD format
            const [year, month, day] = dateStr.split('-').map(Number);
            const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
            const endDate = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
            
            console.log("Date filter - Start:", startDate, "End:", endDate);
            
            filterConditions.push(
                sql`DATE(${attendance.date}) = ${dateStr}`
            );
        }

        if (status) {
            console.log("Adding status filter:", status);
            filterConditions.push(eq(attendance.status, String(status) as any));
        }

        if (departmentId) {
            console.log("Adding departmentId filter:", departmentId);
            filterConditions.push(eq(classes.departmentId, Number(departmentId)));
        }

        if (search) {
            console.log("Adding search filter:", search);
            filterConditions.push(
                ilike(students.name, `%${search}%`)
            );
        }

        if (rollNumber) {
            console.log("Adding rollNumber filter:", rollNumber);
            filterConditions.push(
                ilike(students.rollNumber, `%${rollNumber}%`)
            );
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined;

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(attendance)
            .leftJoin(classes, eq(attendance.classId, classes.id))
            .leftJoin(students, eq(attendance.studentId, students.id))
            .where(whereClause);

        const totalCount = countResult[0]?.count ?? 0;

        const attendanceRecords = await db
            .select({
                ...getTableColumns(attendance),
                class: {
                    id: classes.id,
                    name: classes.name,
                },
                student: {
                    id: students.id,
                    name: students.name,
                    rollNumber: students.rollNumber,
                },
            })
            .from(attendance)
            .leftJoin(classes, eq(attendance.classId, classes.id))
            .leftJoin(students, eq(attendance.studentId, students.id))
            .where(whereClause)
            .orderBy(desc(attendance.date))
            .limit(limitPerPage)
            .offset(offset);

        res.status(200).json({
            data: attendanceRecords,
            pagination: {
                page: currentPage,
                limit: limitPerPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPerPage),
            }
        });

    } catch (e) {
        console.error(`GET /attendance error: ${e}`);
        res.status(500).json({ error: 'Failed to get attendance records' });
    }
});

// Get attendance by ID
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const record = await db
            .select({
                ...getTableColumns(attendance),
                class: {
                    id: classes.id,
                    name: classes.name,
                },
                student: {
                    id: students.id,
                    name: students.name,
                    rollNumber: students.rollNumber,
                },
            })
            .from(attendance)
            .leftJoin(classes, eq(attendance.classId, classes.id))
            .leftJoin(students, eq(attendance.studentId, students.id))
            .where(eq(attendance.id, Number(id)))
            .limit(1);

        if (record.length === 0) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }

        res.status(200).json({ data: record[0] });

    } catch (e) {
        console.error(`GET /attendance/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to get attendance record' });
    }
});

// Create attendance record
router.post("/", async (req, res) => {
    try {
        const { classId, studentId, date, status, remarks } = req.body;

        if (!classId || !studentId || !date || !status) {
            return res.status(400).json({
                error: 'Missing required fields: classId, studentId, date, status'
            });
        }

        if (!['present', 'absent', 'late'].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status. Must be one of: present, absent, late'
            });
        }

        // Check if class exists
        const classExists = await db
            .select()
            .from(classes)
            .where(eq(classes.id, Number(classId)))
            .limit(1);

        if (classExists.length === 0) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // Check if student exists
        const studentExists = await db
            .select()
            .from(students)
            .where(eq(students.id, Number(studentId)))
            .limit(1);

        if (studentExists.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Create attendance record
        const newRecord = await db
            .insert(attendance)
            .values({
                classId: Number(classId),
                studentId: Number(studentId),
                date: new Date(date),
                status: status as any,
                remarks,
            })
            .returning();

        res.status(201).json({
            data: newRecord[0]
        });

    } catch (e: any) {
        console.error(`POST /attendance error: ${e}`);
        if (e.code === '23505') {
            return res.status(400).json({
                error: 'Attendance record for this student in this class on this date already exists'
            });
        }
        res.status(500).json({ error: 'Failed to create attendance record' });
    }
});

// Bulk create attendance records
router.post("/bulk", async (req, res) => {
    try {
        const { records } = req.body;

        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({
                error: 'Invalid input. Provide an array of attendance records'
            });
        }

        // Validate all records
        for (const record of records) {
            if (!record.classId || !record.studentId || !record.date || !record.status) {
                return res.status(400).json({
                    error: 'Each record must have: classId, studentId, date, status'
                });
            }
            if (!['present', 'absent', 'late'].includes(record.status)) {
                return res.status(400).json({
                    error: 'Invalid status. Must be one of: present, absent, late'
                });
            }
        }

        // Insert all records
        const createdRecords = await db
            .insert(attendance)
            .values(
                records.map((r: any) => ({
                    classId: Number(r.classId),
                    studentId: Number(r.studentId),
                    date: new Date(r.date),
                    status: r.status,
                    remarks: r.remarks,
                }))
            )
            .returning();

        res.status(201).json({
            data: createdRecords,
            count: createdRecords.length
        });

    } catch (e: any) {
        console.error(`POST /attendance/bulk error: ${e}`);
        res.status(500).json({ error: 'Failed to create attendance records' });
    }
});

// Update attendance record
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;

        if (!status && remarks === undefined) {
            return res.status(400).json({
                error: 'Provide at least one field to update: status, remarks'
            });
        }

        if (status && !['present', 'absent', 'late'].includes(status)) {
            return res.status(400).json({
                error: 'Invalid status. Must be one of: present, absent, late'
            });
        }

        // Check if record exists
        const existingRecord = await db
            .select()
            .from(attendance)
            .where(eq(attendance.id, Number(id)))
            .limit(1);

        if (existingRecord.length === 0) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }

        const updatedRecord = await db
            .update(attendance)
            .set({
                status: status as any,
                remarks,
                updatedAt: new Date(),
            })
            .where(eq(attendance.id, Number(id)))
            .returning();

        res.status(200).json({
            data: updatedRecord[0]
        });

    } catch (e) {
        console.error(`PUT /attendance/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to update attendance record' });
    }
});

// Delete attendance record
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Check if record exists
        const existingRecord = await db
            .select()
            .from(attendance)
            .where(eq(attendance.id, Number(id)))
            .limit(1);

        if (existingRecord.length === 0) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }

        await db
            .delete(attendance)
            .where(eq(attendance.id, Number(id)));

        res.status(200).json({
            message: 'Attendance record deleted successfully'
        });

    } catch (e) {
        console.error(`DELETE /attendance/:id error: ${e}`);
        res.status(500).json({ error: 'Failed to delete attendance record' });
    }
});

// Get attendance report for a class on a specific date
router.get("/class/:classId/date/:date", async (req, res) => {
    try {
        const { classId, date } = req.params;

        const targetDate = new Date(String(date));
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);

        const records = await db
            .select({
                ...getTableColumns(attendance),
                student: {
                    id: students.id,
                    name: students.name,
                    rollNumber: students.rollNumber,
                },
            })
            .from(attendance)
            .leftJoin(students, eq(attendance.studentId, students.id))
            .where(
                and(
                    eq(attendance.classId, Number(classId)),
                    sql`${attendance.date} >= ${targetDate} AND ${attendance.date} < ${nextDate}`
                )
            )
            .orderBy(students.name);

        res.status(200).json({
            data: records,
            date: targetDate.toISOString().split('T')[0],
            classId: Number(classId)
        });

    } catch (e) {
        console.error(`GET /attendance/class/:classId/date/:date error: ${e}`);
        res.status(500).json({ error: 'Failed to get attendance report' });
    }
});

// Get attendance report for a specific student
router.get("/student/:studentId", async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get all attendance records for the student
        const attendanceRecords = await db
            .select({
                ...getTableColumns(attendance),
                class: {
                    id: classes.id,
                    name: classes.name,
                },
            })
            .from(attendance)
            .leftJoin(classes, eq(attendance.classId, classes.id))
            .where(eq(attendance.studentId, Number(studentId)))
            .orderBy(desc(attendance.date));

        // Calculate statistics
        const total = attendanceRecords.length;
        const present = attendanceRecords.filter(a => a.status === 'present').length;
        const absent = attendanceRecords.filter(a => a.status === 'absent').length;
        const late = attendanceRecords.filter(a => a.status === 'late').length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        // Group by class
        const byClass = attendanceRecords.reduce((acc: any, record) => {
            const classId = record.class?.id;
            const className = record.class?.name || 'Unknown';
            
            if (!acc[classId]) {
                acc[classId] = {
                    classId,
                    className,
                    present: 0,
                    absent: 0,
                    late: 0,
                    total: 0,
                    percentage: 0,
                };
            }

            acc[classId].total += 1;
            if (record.status === 'present') acc[classId].present += 1;
            if (record.status === 'absent') acc[classId].absent += 1;
            if (record.status === 'late') acc[classId].late += 1;
            acc[classId].percentage = Math.round((acc[classId].present / acc[classId].total) * 100);

            return acc;
        }, {});

        res.status(200).json({
            data: {
                summary: {
                    total,
                    present,
                    absent,
                    late,
                    percentage,
                },
                byClass: Object.values(byClass),
            }
        });

    } catch (e) {
        console.error(`GET /attendance/student/:studentId error: ${e}`);
        res.status(500).json({ error: 'Failed to get attendance report' });
    }
});

export default router;
