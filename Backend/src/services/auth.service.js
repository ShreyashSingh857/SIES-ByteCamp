//auth services
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getSession } from '../config/neo4j.js';

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

function requireEnv(name) {
	const value = process.env[name];
	if (!value) throw new Error(`Missing required env var: ${name}`);
	return value;
}

export async function exchangeGithubCode(code) {
	const { data } = await axios.post(
		GITHUB_OAUTH_URL,
		{
			client_id: requireEnv('GITHUB_CLIENT_ID'),
			client_secret: requireEnv('GITHUB_CLIENT_SECRET'),
			code,
			redirect_uri: requireEnv('GITHUB_CALLBACK_URL'),
		},
		{
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
			timeout: 15000,
		}
	);

	if (!data?.access_token) {
		throw new Error(data?.error_description || 'Failed to exchange GitHub code');
	}

	return {
		access_token: data.access_token,
		refresh_token: data.refresh_token || null,
		expires_in: data.expires_in || null,
	};
}

export async function getGithubUser(accessToken) {
	const { data } = await axios.get(GITHUB_USER_URL, {
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${accessToken}`,
			'X-GitHub-Api-Version': '2022-11-28',
		},
		timeout: 15000,
	});
	return data;
}

export async function upsertUserInNeo4j(githubUser, accessToken, refreshToken = null, tokenExpiresAt = null) {
	const session = getSession();
	try {
		const result = await session.run(
			`
			MERGE (u:User {githubId: $githubId})
			SET u.id = COALESCE(u.id, $newId),
					u.githubLogin = $login,
					u.name = $name,
					u.email = $email,
					u.avatarUrl = $avatarUrl,
					u.accessToken = $accessToken,
					u.refreshToken = $refreshToken,
					u.tokenExpiresAt = $tokenExpiresAt,
					u.lastSeenAt = datetime()
			ON CREATE SET u.createdAt = datetime()
			RETURN u
			`,
			{
				githubId: String(githubUser.id),
				newId: randomUUID(),
				login: githubUser.login || '',
				name: githubUser.name || githubUser.login || 'GitHub User',
				email: githubUser.email || null,
				avatarUrl: githubUser.avatar_url || null,
				accessToken,
				refreshToken,
				tokenExpiresAt,
			}
		);

		const userNode = result.records[0]?.get('u')?.properties;
		if (!userNode) throw new Error('Failed to upsert user');
		return userNode;
	} finally {
		await session.close();
	}
}

export function issueJwt(userId) {
	const accessToken = jwt.sign(
		{ sub: userId, type: 'access' },
		requireEnv('JWT_SECRET'),
		{ expiresIn: '15m' }
	);

	const refreshToken = jwt.sign(
		{ sub: userId, type: 'refresh' },
		requireEnv('JWT_REFRESH_SECRET'),
		{ expiresIn: '7d' }
	);

	return { accessToken, refreshToken };
}

export function verifyJwt(token, kind = 'access') {
	const secret = kind === 'refresh' ? requireEnv('JWT_REFRESH_SECRET') : requireEnv('JWT_SECRET');
	const decoded = jwt.verify(token, secret);
	if (!decoded?.sub) throw new Error('Invalid token payload');
	if (decoded?.type && decoded.type !== kind) throw new Error('Invalid token type');
	return decoded;
}
