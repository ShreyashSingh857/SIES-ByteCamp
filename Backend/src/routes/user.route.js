import express from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { getMe, getMyRepos } from "../controllers/user.controller.js";

const router = express.Router();

router.use(requireAuth);
router.get("/me", getMe);
router.get("/me/repos", getMyRepos);

export default router;
