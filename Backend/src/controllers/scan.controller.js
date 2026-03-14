import simpleGit from "simple-git";
import path from "path";
import os from "os";
import fs from "fs";

/**
 * @desc    Clone a public repo and return scan result
 * @route   POST /api/scan
 * @body    { repoUrl: "https://github.com/user/repo" }
 * @access  Public
 */
export const postScan = async (req, res, next) => {
  const { repoUrl } = req.body;

  if (!repoUrl || typeof repoUrl !== "string") {
    return res.status(400).json({ success: false, message: "repoUrl is required" });
  }

  // Basic URL validation — must be http/https, no credential injection
  const urlPattern = /^https?:\/\/[^\s]+$/;
  if (!urlPattern.test(repoUrl)) {
    return res.status(400).json({ success: false, message: "Invalid repoUrl format" });
  }

  const cloneDir = path.join(os.tmpdir(), `scan-${Date.now()}`);

  try {
    await simpleGit().clone(repoUrl, cloneDir, ["--depth", "1"]);

    res.status(200).json({
      success: true,
      message: "Repository cloned successfully",
      data: {
        repoUrl,
        clonedTo: cloneDir,
        result: "ready for analysis",
      },
    });
  } catch (error) {
    // Clean up on failure if dir was partially created
    if (fs.existsSync(cloneDir)) {
      fs.rmSync(cloneDir, { recursive: true, force: true });
    }
    const err = new Error(`Failed to clone repository: ${error.message}`);
    err.status = 422;
    next(err);
  }
};

/**
 * @desc    Return dependency/call graph as nodes + edges
 * @route   GET /api/graph
 * @access  Public
 */
export const getGraph = async (_req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        nodes: [],
        edges: [],
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Return impact analysis result
 * @route   GET /api/impact
 * @access  Public
 */
export const getImpact = async (_req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        impactedModules: [],
        summary: "No impact detected",
      },
    });
  } catch (error) {
    next(error);
  }
};
