import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
    importDependencyGraphToNeo4j,
    getScanDetails,
    getAllScans,
    deleteOldScans,
} from '../services/neo4j-import.service.js';

const execAsync = promisify(exec);

/**
 * Run AI-Engine analysis with LLM and import results to Neo4j
 */
export async function analyzeWithLLMAndImport(req, res, next) {
    try {
        const { repoPath, outputPath } = req.body;

        if (!repoPath) {
            return res.status(400).json({
                success: false,
                message: 'repoPath is required',
            });
        }

        const scanId = uuidv4();
        const outPath = outputPath || path.join(process.cwd(), 'output', `${scanId}.json`);

        // Run AI-Engine with LLM analysis
        console.log(`🔍 Starting AI-Engine analysis with LLM for: ${repoPath}`);

        const aiEnginePath = path.resolve(process.cwd(), '../AI-Engine');
        const command = `cd "${aiEnginePath}" && node src/index.js --repo "${repoPath}" --out "${outPath}" --with-llm`;

        const { stdout, stderr } = await execAsync(command, { timeout: 300000 }); // 5 min timeout

        if (stderr && !stderr.includes('deprecated')) {
            console.warn('AI-Engine stderr:', stderr);
        }

        // Read the generated graph
        const graphData = JSON.parse(await fs.readFile(outPath, 'utf-8'));

        console.log(`✅ AI-Engine analysis complete. Nodes: ${graphData.nodes?.length}, Edges: ${graphData.edges?.length}`);

        // Import to Neo4j
        console.log('📊 Importing to Neo4j...');
        const importResult = await importDependencyGraphToNeo4j(graphData, scanId);

        console.log(`✅ Neo4j import complete: ${importResult.nodesImported} nodes, ${importResult.edgesImported} edges`);

        res.json({
            success: true,
            scanId,
            importResult,
            aiEngineOutput: {
                nodesAnalyzed: graphData.nodes?.length || 0,
                edgesFound: graphData.edges?.length || 0,
                llmModel: process.env.OPENAI_MODEL,
                outputFile: outPath,
            },
        });
    } catch (error) {
        console.error('Analysis and import error:', error);
        res.status(500).json({
            success: false,
            message: error.message,
            error: error.toString(),
        });
    }
}

/**
 * Get scan details and statistics
 */
export async function getScanStats(req, res, next) {
    try {
        const { scanId } = req.params;

        if (!scanId) {
            return res.status(400).json({
                success: false,
                message: 'scanId is required',
            });
        }

        const details = await getScanDetails(scanId);

        if (!details) {
            return res.status(404).json({
                success: false,
                message: 'Scan not found',
            });
        }

        res.json({
            success: true,
            data: details,
        });
    } catch (error) {
        console.error('Get scan error:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

/**
 * List all scans
 */
export async function listScans(req, res, next) {
    try {
        const scans = await getAllScans();

        res.json({
            success: true,
            data: scans,
        });
    } catch (error) {
        console.error('List scans error:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

/**
 * Delete a scan and its data
 */
export async function deleteScan(req, res, next) {
    try {
        const { scanId } = req.params;

        if (!scanId) {
            return res.status(400).json({
                success: false,
                message: 'scanId is required',
            });
        }

        const result = await deleteOldScans(scanId);

        res.json({
            success: true,
            message: 'Scan deleted',
            data: result,
        });
    } catch (error) {
        console.error('Delete scan error:', error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}
