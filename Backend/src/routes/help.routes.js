import { Router } from "express";
import {
  getHelpTopics,
  getHelpTopicById,
  searchHelp,
} from "../controllers/help.controller.js";

const router = Router();

// GET /api/help          → list all help topics
router.get("/", getHelpTopics);

// GET /api/help/search?q=keyword  → search help topics
router.get("/search", searchHelp);

// GET /api/help/:id      → single topic by id
router.get("/:id", getHelpTopicById);

export default router;
