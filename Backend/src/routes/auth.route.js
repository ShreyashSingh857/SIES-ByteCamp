import express from 'express';
import {
	githubRedirect,
	githubCallback,
	refreshToken,
	logout,
} from '../controllers/auth.controller.js';

const router = express.Router();

router.get('/github', githubRedirect);
router.get('/github/callback', githubCallback);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

export default router;