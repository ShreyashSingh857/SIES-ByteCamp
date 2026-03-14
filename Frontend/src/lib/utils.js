import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function normalizeRepoUrl(repoUrl = '') {
    const trimmed = String(repoUrl || '').trim();
    if (!trimmed) return '';

    if (!/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/\/+$/, '');
    }

    try {
        const url = new URL(trimmed);
        url.pathname = url.pathname.replace(/\.git$/i, '').replace(/\/+$/, '');
        return url.toString().replace(/\/+$/, '');
    } catch {
        return trimmed.replace(/\.git$/i, '').replace(/\/+$/, '');
    }
}

export function parseGitHubRepoInfo(repoUrl = '') {
    const normalized = normalizeRepoUrl(repoUrl);
    try {
        const url = new URL(normalized);
        if (!/github\.com$/i.test(url.hostname)) return null;
        const [owner, repo] = url.pathname.replace(/^\//, '').split('/');
        if (!owner || !repo) return null;
        return { owner, repo, normalizedUrl: `https://github.com/${owner}/${repo}` };
    } catch {
        return null;
    }
}

export function encodeRepoPath(filePath = '') {
    return String(filePath || '')
        .split('/')
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join('/');
}

export function buildGitHubBlobUrl(repoUrl, branch, filePath) {
    const repoInfo = parseGitHubRepoInfo(repoUrl);
    if (!repoInfo || !filePath) return null;
    return `${repoInfo.normalizedUrl}/blob/${encodeURIComponent(branch || 'main')}/${encodeRepoPath(filePath)}`;
}

export function buildGitHubTreeUrl(repoUrl, branch, dirPath) {
    const repoInfo = parseGitHubRepoInfo(repoUrl);
    if (!repoInfo || !dirPath) return null;
    return `${repoInfo.normalizedUrl}/tree/${encodeURIComponent(branch || 'main')}/${encodeRepoPath(dirPath)}`;
}

export function buildGitHubRawUrl(repoUrl, branch, filePath) {
    const repoInfo = parseGitHubRepoInfo(repoUrl);
    if (!repoInfo || !filePath) return null;
    return `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${encodeURIComponent(branch || 'main')}/${encodeRepoPath(filePath)}`;
}