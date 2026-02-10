import express from "express";
import { eq, getTableColumns } from "drizzle-orm";
import { departments, subjects, classes, enrollments } from "../db/schema/index.js";
import { user } from "../db/schema/index.js";
import { db } from "../db/index.js";

const router = express.Router();

// Get all departments
router.get("/", async (req, res) => {
  try {
    const departmentList = await db
      .select({
        ...getTableColumns(departments),
        headTeacher: getTableColumns(user),
      })
      .from(departments)
      .leftJoin(user, eq(departments.headTeacherId, user.id));

    res.status(200).json({
      data: departmentList,
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

    res.status(200).json({ data: department });
  } catch (error) {
    console.error(`GET /departments/:id error: ${error}`);
    res.status(500).json({ error: "Failed to fetch department" });
  }
});

// Create a new department
router.post("/", async (req, res) => {
  try {
    const { name, description, bannerUrl, bannerCldPubId, headTeacherId } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Department name is required" });
    }

    if (!description) {
      return res.status(400).json({ error: "Department description is required" });
    }

    if (!bannerUrl || !bannerCldPubId) {
      return res.status(400).json({ error: "Department banner is required" });
    }

    if (!headTeacherId) {
      return res.status(400).json({ error: "Department head teacher is required" });
    }

    // Generate a unique code from department name
    const code = name.toUpperCase().replace(/\s+/g, "_").substring(0, 50);

    const result = await db
      .insert(departments)
      .values({
        code,
        name,
        description,
        bannerUrl,
        bannerCldPubId,
        headTeacherId,
      })
      .returning();

    res.status(201).json({
      data: result[0],
      message: "Department created successfully",
    });
  } catch (error) {
    console.error(`POST /departments error: ${error}`);
    res.status(500).json({ error: "Failed to create department" });
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
      await db
        .delete(classes)
        .where(eq(classes.subjectId, subject.id));
    }

    // Delete subjects
    await db
      .delete(subjects)
      .where(eq(subjects.departmentId, departmentId));

    // Delete the department
    const result = await db
      .delete(departments)
      .where(eq(departments.id, departmentId))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: "Department not found" });
    }

    res.status(200).json({
      data: result[0],
      message: "Department deleted successfully",
    });
  } catch (error) {
    console.error(`DELETE /departments/:id error: ${error}`);
    res.status(500).json({ error: "Failed to delete department" });
  }
});

export default router;
