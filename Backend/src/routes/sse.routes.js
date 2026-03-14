import { Router } from "express";
import { addClient } from "../services/sse.service.js";

const router = Router();

router.get("/:repoId", (req, res) => {
  addClient(req.params.repoId, res);
});

export default router;
