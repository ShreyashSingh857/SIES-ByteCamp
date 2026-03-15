import axios from "axios";
import { getSession } from "../config/neo4j.js";

export const getMe = async (req, res, next) => {
  const session = getSession();
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})
      RETURN u
      LIMIT 1
      `,
      { userId: req.user.id }
    );

    const user = result.records[0]?.get("u")?.properties;
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        githubId: user.githubId,
        githubLogin: user.githubLogin,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    return next(error);
  } finally {
    await session.close();
  }
};

export const getMyRepos = async (req, res, next) => {
  const session = getSession();
  try {
    const result = await session.run(
      `
      MATCH (u:User {id: $userId})
      RETURN u.accessToken AS accessToken
      LIMIT 1
      `,
      { userId: req.user.id }
    );

    const accessToken = result.records[0]?.get("accessToken") || null;
    if (!accessToken) {
      return res.status(404).json({ success: false, message: "GitHub token not found for user" });
    }

    const githubResponse = await axios.get("https://api.github.com/user/repos", {
      params: { sort: "updated", per_page: 100, type: "owner" },
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      timeout: 15000,
    });

    const repos = (githubResponse.data || []).map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      updated_at: repo.updated_at,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      default_branch: repo.default_branch,
    }));

    return res.status(200).json({ success: true, data: repos });
  } catch (error) {
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      return res.status(401).json({ success: false, message: "GitHub token expired or unauthorized" });
    }
    return next(error);
  } finally {
    await session.close();
  }
};
