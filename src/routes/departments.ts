import express from "express";
import { departments } from "../db/schema";
import { db } from "../db";

const router = express.Router();

// Get all departments
router.get("/", async (req, res) => {
  try {
    const departmentList = await db.select().from(departments);

    res.status(200).json({
      data: departmentList,
    });
  } catch (error) {
    console.error(`GET /departments error: ${error}`);
    res.status(500).json({ error: "Failed to fetch departments" });
  }
});

export default router;
