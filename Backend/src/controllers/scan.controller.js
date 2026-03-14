import simpleGit from "simple-git";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const WORKSPACE_ROOT = path.join(PROJECT_ROOT, "workspace");
const REPOSITORIES_ROOT = path.join(WORKSPACE_ROOT, "repositories");
const AI_ENGINE_ENTRY = path.join(PROJECT_ROOT, "AI-Engine", "src", "index.js");

function buildUniqueRepoDir(repoUrl) {
  const baseName = path.basename(repoUrl).replace(/\.git$/i, "") || "repo";
  const safe = baseName.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return path.join(REPOSITORIES_ROOT, `${safe}-${suffix}`);
}

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

  // Accept public HTTP(S) URLs and absolute local paths.
  const isHttpUrl = /^https?:\/\/[^\s]+$/i.test(repoUrl);
  const isLocalAbsolutePath = path.isAbsolute(repoUrl);
  if (!isHttpUrl && !isLocalAbsolutePath) {
    return res.status(400).json({
      success: false,
      message: "repoUrl must be a public http(s) URL or absolute local path",
    });
  }

  const cloneDir = buildUniqueRepoDir(repoUrl);

  try {
    fs.mkdirSync(REPOSITORIES_ROOT, { recursive: true });
    await simpleGit().clone(repoUrl, cloneDir);

    const { stdout } = await execFileAsync(
      process.execPath,
      [AI_ENGINE_ENTRY, "--repo", cloneDir],
      {
        cwd: PROJECT_ROOT,
        maxBuffer: 20 * 1024 * 1024,
      }
    );

    let parserResult = null;
    try {
      parserResult = JSON.parse(stdout);
    } catch {
      parserResult = { raw: stdout };
    }

    res.status(200).json({
      success: true,
      message: "Repository cloned and parsed successfully",
      data: {
        repoUrl,
        workspaceDir: WORKSPACE_ROOT,
        repositoriesDir: REPOSITORIES_ROOT,
        clonedRepoPath: cloneDir,
        parserInputPath: cloneDir,
        parserSummary: parserResult?.summary || null,
      },
    });
  } catch (error) {
    const err = new Error(`Failed to clone/parse repository: ${error.message}`);
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
