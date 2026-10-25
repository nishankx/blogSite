import express from 'express';
import { getBlogs, getBlog, postBlog, updateBlog, deleteBlog } from '../controllers/blogControllers.js';
import { requireAdminAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getBlogs);

// Admin verification
router.get('/auth/verify', requireAdminAuth, (req, res) => {
    res.status(200).json({ success: true, message: "Admin verified successfully" });
});

router.get('/:id', getBlog);

// Admin-protected routes
router.post('/', requireAdminAuth, postBlog);
router.put('/:id', requireAdminAuth, updateBlog);
router.delete('/:id', requireAdminAuth, deleteBlog);

export default router;