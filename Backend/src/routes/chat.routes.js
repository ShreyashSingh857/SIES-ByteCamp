import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
  listSessions,
  createSession,
  getSessionHistory,
  sendMessage,
  resolveFileContext,
  deleteSession,
} from "../controllers/chat.controller.js";

const router = express.Router();
router.use(requireAuth);
router.get("/", listSessions);
router.post("/", createSession);
router.get("/:sessionId", getSessionHistory);
router.post("/:sessionId/messages", sendMessage);
router.post("/:sessionId/resolve-file", resolveFileContext);
router.delete("/:sessionId", deleteSession);

export default router;
