import { randomBytes } from 'crypto';
import {
	exchangeGithubCode,
	getGithubUser,
	issueJwt,
	upsertUserInNeo4j,
	verifyJwt,
} from '../services/auth.service.js';

const OAUTH_STATE_COOKIE = 'oauth_state';
const REFRESH_COOKIE = 'refreshToken';

function cookieBaseOptions() {
	return {
		httpOnly: true,
		sameSite: 'strict',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
	};
}

export const githubRedirect = async (_req, res, next) => {
	try {
		const clientId = process.env.GITHUB_CLIENT_ID;
		const callbackUrl = process.env.GITHUB_CALLBACK_URL;
		if (!clientId || !callbackUrl) {
			return res.status(500).json({ success: false, message: 'GitHub OAuth is not configured' });
		}

		const state = randomBytes(24).toString('hex');
		res.cookie(OAUTH_STATE_COOKIE, state, {
			...cookieBaseOptions(),
			maxAge: 10 * 60 * 1000,
			signed: true,
		});

		const githubUrl = new URL('https://github.com/login/oauth/authorize');
		githubUrl.searchParams.set('client_id', clientId);
		githubUrl.searchParams.set('scope', 'repo user:email');
		githubUrl.searchParams.set('redirect_uri', callbackUrl);
		githubUrl.searchParams.set('state', state);

		return res.redirect(githubUrl.toString());
	} catch (error) {
		return next(error);
	}
};

export const githubCallback = async (req, res, next) => {
	try {
		const { code, state } = req.query;
		const storedState = req.signedCookies?.[OAUTH_STATE_COOKIE] || null;

		if (!code || !state) {
			return res.status(400).json({ success: false, message: 'Missing code/state in callback' });
		}

		if (!storedState || String(state) !== String(storedState)) {
			return res.status(403).json({ success: false, message: 'Invalid OAuth state' });
		}

		res.clearCookie(OAUTH_STATE_COOKIE, { ...cookieBaseOptions(), signed: true });

		const tokenData = await exchangeGithubCode(String(code));
		const githubUser = await getGithubUser(tokenData.access_token);

		const tokenExpiresAt = tokenData.expires_in
			? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
			: null;

		const user = await upsertUserInNeo4j(
			githubUser,
			tokenData.access_token,
			tokenData.refresh_token,
			tokenExpiresAt
		);

		const { accessToken, refreshToken } = issueJwt(user.id);

		res.cookie(REFRESH_COOKIE, refreshToken, {
			...cookieBaseOptions(),
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
		const redirectTarget = `${clientUrl}/auth/callback?token=${encodeURIComponent(accessToken)}`;
		return res.redirect(redirectTarget);
	} catch (error) {
		return next(error);
	}
};

export const refreshToken = async (req, res, next) => {
	try {
		const token = req.cookies?.[REFRESH_COOKIE];
		if (!token) return res.status(401).json({ success: false, message: 'Refresh token missing' });

		const decoded = verifyJwt(token, 'refresh');
		const tokens = issueJwt(decoded.sub);

		res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
			...cookieBaseOptions(),
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		return res.status(200).json({ success: true, data: { accessToken: tokens.accessToken } });
	} catch (error) {
		return res.status(401).json({ success: false, message: 'Invalid refresh token' });
	}
};

export const logout = async (_req, res) => {
	res.clearCookie(REFRESH_COOKIE, cookieBaseOptions());
	return res.status(200).json({ success: true, message: 'Logged out' });
};