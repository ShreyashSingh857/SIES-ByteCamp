import { Router } from "express";
import { handleGithubWebhook } from "../controllers/webhook.controller.js";

const router = Router();

router.post("/github", handleGithubWebhook);

export default router;
