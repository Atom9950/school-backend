import express from "express";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";

import { db } from "../db/index.js";
import {
  classes,
  departments,
  subjects,
  teacherClasses,
} from "../db/schema/app.js";
import { user } from "../db/schema/auth.js";

// Check if teacher filter is numeric (ID) or string (name)
const isNumericId = (value: string): boolean => {
  return /^\d+$/.test(value.trim());
};

const router = express.Router();

// Get all classes with optional search, filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      search,
      subject,
      teacher,
      department,
      page = 1,
      limit = 10,
    } = req.query;

    const currentPage = Math.max(1, parseInt(String(page), 10) || 1);
    const limitPerPage = Math.min(
      Math.max(1, parseInt(String(limit), 10) || 10),
      100,
    ); // Max 100 records per page

    const offset = (currentPage - 1) * limitPerPage;

    const filterConditions = [];

    // If search query exists, filter by class name OR invite code
    if (search) {
      filterConditions.push(
        or(
          ilike(classes.name, `%${search}%`),
          ilike(classes.inviteCode, `%${search}%`),
        ),
      );
    }

    // If department filter exists, match department id
    if (department) {
      const departmentId = parseInt(String(department), 10);
      if (!isNaN(departmentId)) {
        filterConditions.push(eq(classes.departmentId, departmentId));
      }
    }

    // If subject filter exists, match subject name
    if (subject) {
      const subjectPattern = `%${String(subject).replace(/[%_]/g, "\\$&")}%`;
      filterConditions.push(ilike(subjects.name, subjectPattern));
    }

    // Combine all filters using AND if any exist
    const whereClause =
      filterConditions.length > 0 ? and(...filterConditions) : undefined;

    // Handle teacher filter (can be ID for teacherClasses filter or name for teacher name filter)
    let departmentList: any[];
    let totalCount = 0;

    if (teacher) {
      const teacherId = String(teacher);
      // Filter by teacher ID - classes have a teacherId field directly
      console.log(`Filtering classes by teacherId: ${teacherId}`);

      const countResult = await db
        .select({ count: sql<number>`count(distinct ${classes.id})` })
        .from(classes)
        .leftJoin(subjects, eq(classes.subjectId, subjects.id))
        .leftJoin(user, eq(classes.teacherId, user.id))
        .leftJoin(departments, eq(classes.departmentId, departments.id))
        .where(eq(classes.teacherId, teacherId));

      console.log(`Count result for teacher ${teacherId}:`, countResult);

      totalCount = countResult[0]?.count ?? 0;

      departmentList = await db
        .select({
          ...getTableColumns(classes),
          subject: { ...getTableColumns(subjects) },
          teacher: { ...getTableColumns(user) },
          department: { ...getTableColumns(departments) },
        })
        .from(classes)
        .leftJoin(subjects, eq(classes.subjectId, subjects.id))
        .leftJoin(user, eq(classes.teacherId, user.id))
        .leftJoin(departments, eq(classes.departmentId, departments.id))
        .where(eq(classes.teacherId, teacherId))
        .orderBy(desc(classes.createdAt))
        .limit(limitPerPage)
        .offset(offset);

      console.log(
        `Classes for teacher ${teacherId}:`,
        departmentList?.length || 0,
      );
    } else {
      const countResult = await db
        .select({ count: sql<number>`count(distinct ${classes.id})` })
        .from(classes)
        .leftJoin(subjects, eq(classes.subjectId, subjects.id))
        .leftJoin(user, eq(classes.teacherId, user.id))
        .leftJoin(departments, eq(classes.departmentId, departments.id))
        .where(whereClause);

      totalCount = countResult[0]?.count ?? 0;

      departmentList = await db
        .select({
          ...getTableColumns(classes),
          subject: { ...getTableColumns(subjects) },
          teacher: { ...getTableColumns(user) },
          department: { ...getTableColumns(departments) },
        })
        .from(classes)
        .leftJoin(subjects, eq(classes.subjectId, subjects.id))
        .leftJoin(user, eq(classes.teacherId, user.id))
        .leftJoin(departments, eq(classes.departmentId, departments.id))
        .where(whereClause)
        .orderBy(desc(classes.createdAt))
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
  } catch (e) {
    console.error(`GET /classes error: ${e}`);
    res.status(500).json({ error: "Failed to get classes" });
  }
});

// Get class details with teacher, subject, and department
router.get("/:id", async (req, res) => {
  const classId = Number(req.params.id);

  if (!Number.isFinite(classId))
    return res.status(400).json({ error: "No Class found." });

  const [classDetails] = await db
    .select({
      ...getTableColumns(classes),
      subject: {
        ...getTableColumns(subjects),
      },
      department: {
        ...getTableColumns(departments),
      },
      teacher: {
        ...getTableColumns(user),
      },
    })
    .from(classes)
    .leftJoin(subjects, eq(classes.subjectId, subjects.id))
    .leftJoin(user, eq(classes.teacherId, user.id))
    .leftJoin(departments, eq(classes.departmentId, departments.id))
    .where(eq(classes.id, classId));

  if (!classDetails) return res.status(404).json({ error: "No Class found." });

  res.status(200).json({ data: classDetails });
});

router.post("/", async (req, res) => {
  try {
    const { teacherId, ...classData } = req.body;

    const [createdClass] = await db
      .insert(classes)
      .values({
        ...classData,
        teacherId: teacherId || null,
        inviteCode: Math.random().toString(36).substring(2, 9),
        schedules: [],
      })
      .returning({ id: classes.id });

    if (!createdClass) throw Error;

    // If a teacher is assigned, add the relationship to teacherClasses
    if (teacherId) {
      await db
        .insert(teacherClasses)
        .values({
          teacherId: teacherId,
          classId: createdClass.id,
        })
        .catch((e) => {
          console.warn(`Failed to insert teacherClasses relationship: ${e}`);
        });
    }

    res.status(201).json({ data: createdClass });
  } catch (e) {
    console.error(`POST /classes error ${e}`);
    res.status(500).json({ error: e });
  }
});

// Update a class (PUT)
router.put("/:id", async (req, res) => {
  try {
    const classId = Number(req.params.id);

    if (!Number.isFinite(classId))
      return res.status(400).json({ error: "Invalid class ID." });

    const { teacherId, ...classData } = req.body;

    // Include teacherId in the update if provided
    const updateData =
      teacherId !== undefined ? { ...classData, teacherId } : classData;

    const [updatedClass] = await db
      .update(classes)
      .set(updateData)
      .where(eq(classes.id, classId))
      .returning({ id: classes.id });

    if (!updatedClass)
      return res.status(404).json({ error: "Class not found." });

    // Update teacher relationship if teacherId is provided
    if (teacherId !== undefined) {
      // Delete existing relationship
      await db
        .delete(teacherClasses)
        .where(eq(teacherClasses.classId, classId))
        .catch((e) => {
          console.warn(`Failed to delete teacherClasses relationship: ${e}`);
        });

      // Add new relationship if teacherId is not null
      if (teacherId) {
        await db
          .insert(teacherClasses)
          .values({
            teacherId: teacherId,
            classId: classId,
          })
          .catch((e) => {
            console.warn(`Failed to insert teacherClasses relationship: ${e}`);
          });
      }
    }

    res
      .status(200)
      .json({ data: updatedClass, message: "Class updated successfully" });
  } catch (e) {
    console.error(`PUT /classes/:id error ${e}`);
    res.status(500).json({ error: "Failed to update class" });
  }
});

// Update a class (PATCH)
router.patch("/:id", async (req, res) => {
  try {
    const classId = Number(req.params.id);

    if (!Number.isFinite(classId))
      return res.status(400).json({ error: "Invalid class ID." });

    const { teacherId, ...classData } = req.body;

    // Include teacherId in the update if provided
    const updateData =
      teacherId !== undefined ? { ...classData, teacherId } : classData;

    const [updatedClass] = await db
      .update(classes)
      .set(updateData)
      .where(eq(classes.id, classId))
      .returning({ id: classes.id });

    if (!updatedClass)
      return res.status(404).json({ error: "Class not found." });

    // Update teacher relationship if teacherId is provided
    if (teacherId !== undefined) {
      // Delete existing relationship
      await db
        .delete(teacherClasses)
        .where(eq(teacherClasses.classId, classId))
        .catch((e) => {
          console.warn(`Failed to delete teacherClasses relationship: ${e}`);
        });

      // Add new relationship if teacherId is not null
      if (teacherId) {
        await db
          .insert(teacherClasses)
          .values({
            teacherId: teacherId,
            classId: classId,
          })
          .catch((e) => {
            console.warn(`Failed to insert teacherClasses relationship: ${e}`);
          });
      }
    }

    res
      .status(200)
      .json({ data: updatedClass, message: "Class updated successfully" });
  } catch (e) {
    console.error(`PATCH /classes/:id error ${e}`);
    res.status(500).json({ error: "Failed to update class" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const classId = Number(req.params.id);

    if (!Number.isFinite(classId))
      return res.status(400).json({ error: "Invalid class ID." });

    const [deletedClass] = await db
      .delete(classes)
      .where(eq(classes.id, classId))
      .returning({ id: classes.id });

    if (!deletedClass)
      return res.status(404).json({ error: "Class not found." });

    res.status(200).json({ data: deletedClass });
  } catch (e) {
    console.error(`DELETE /classes/:id error ${e}`);
    res.status(500).json({ error: "Failed to delete class" });
  }
});

export default router;
