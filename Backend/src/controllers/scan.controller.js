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
const GRAPHS_ROOT = path.join(WORKSPACE_ROOT, "graphs");
const AI_ENGINE_ENTRY = path.join(PROJECT_ROOT, "AI-Engine", "src", "index.js");

function buildUniqueRepoDir(repoUrl) {
  const baseName = path.basename(repoUrl).replace(/\.git$/i, "") || "repo";
  const safe = baseName.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return path.join(REPOSITORIES_ROOT, `${safe}-${suffix}`);
}

function getRepoIdFromCloneDir(cloneDir) {
  return path.basename(cloneDir);
}

function assertValidRepoId(repoId) {
  if (!repoId || !/^[a-zA-Z0-9-_]+$/.test(repoId)) {
    throw new Error("Invalid repoId format");
  }
}

function getGraphFilePath(repoId) {
  assertValidRepoId(repoId);
  return path.join(GRAPHS_ROOT, `${repoId}.json`);
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
  const repoId = getRepoIdFromCloneDir(cloneDir);

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

    fs.mkdirSync(GRAPHS_ROOT, { recursive: true });
    fs.writeFileSync(getGraphFilePath(repoId), JSON.stringify(parserResult, null, 2), "utf8");

    res.status(200).json({
      success: true,
      message: "Repository cloned and parsed successfully",
      data: {
        repoId,
        repoUrl,
        workspaceDir: WORKSPACE_ROOT,
        repositoriesDir: REPOSITORIES_ROOT,
        clonedRepoPath: cloneDir,
        parserInputPath: cloneDir,
        graphPath: getGraphFilePath(repoId),
        graphApi: `/api/graph/${repoId}`,
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
 * @desc    Return parser graph as nodes + edges for a scanned repo
 * @route   GET /api/graph/:repoId
 * @access  Public
 */
export const getGraph = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const graphFilePath = getGraphFilePath(repoId);

    if (!fs.existsSync(graphFilePath)) {
      return res.status(404).json({
        success: false,
        message: `No graph found for repoId: ${repoId}`,
      });
    }

    const parserResult = JSON.parse(fs.readFileSync(graphFilePath, "utf8"));

    res.status(200).json({
      success: true,
      repoId,
      data: {
        nodes: parserResult?.nodes || [],
        edges: parserResult?.edges || [],
        summary: parserResult?.summary || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete stored parser graph for a scanned repo
 * @route   DELETE /api/graph/:repoId
 * @access  Public
 */
export const deleteGraph = async (req, res, next) => {
  try {
    const { repoId } = req.params;
    const graphFilePath = getGraphFilePath(repoId);

    if (!fs.existsSync(graphFilePath)) {
      return res.status(404).json({
        success: false,
        message: `No graph found for repoId: ${repoId}`,
      });
    }

    fs.unlinkSync(graphFilePath);

    res.status(200).json({
      success: true,
      repoId,
      message: "Graph deleted successfully",
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
