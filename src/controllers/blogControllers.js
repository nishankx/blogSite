import mongoose from 'mongoose';
import Blog from '../models/Blog.js';
import Subscriber from '../models/Subscriber.js';
import { broadcastBlogEmail } from '../utils/mailerHelper.js';

// GET all blogs
export async function getBlogs(req, res) {
    try {
        const { tag, isPublished } = req.query;
        const filter = {};

        if (tag) {
            filter.tags = tag;
        }

        if (isPublished !== undefined) {
            filter.isPublished = isPublished === 'true';
        }

        const blogs = await Blog.find(filter).sort({ createdAt: -1 });

        // Maintain compatibility with both 'blogs' and 'blog'
        res.status(200).json({
            success: true,
            count: blogs.length,
            blogs,
            blog: blogs,
        });
    } catch (err) {
        console.error("Error in getBlogs Controller:", err);
        res.status(500).json({ success: false, message: err.message || "Internal server error" });
    }
}

// GET single blog by ID or Slug
export async function getBlog(req, res) {
    try {
        const { id } = req.params;
        let blog = null;

        // Check if ID is a valid MongoDB ObjectId
        if (mongoose.Types.ObjectId.isValid(id)) {
            blog = await Blog.findById(id);
        }

        // If not found by ObjectId or if param is a slug, try looking up by slug
        if (!blog) {
            blog = await Blog.findOne({ slug: id });
        }

        if (!blog) {
            return res.status(404).json({ success: false, message: "Blog not found!" });
        }

        res.status(200).json({
            success: true,
            blog,
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "Invalid blog ID format" });
        }
        console.error("Error in getBlog controller:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

// POST create blog (Admin protected)
export async function postBlog(req, res) {
    try {
        const {
            title,
            content,
            excerpt,
            coverImage,
            tags,
            readTime,
            slug,
            isPublished,
            notifySubscribers,
            isUpcoming,
            customSubject,
            customNote,
        } = req.body;

        // Request Body Validation
        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Title is required and must be a valid non-empty string",
            });
        }

        if (!content || typeof content !== 'string' || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: "Content is required and must be a valid non-empty string",
            });
        }

        if (tags !== undefined && !Array.isArray(tags)) {
            return res.status(400).json({
                success: false,
                message: "Tags must be an array of strings",
            });
        }

        const blog = new Blog({
            title: title.trim(),
            content: content.trim(),
            excerpt: excerpt ? excerpt.trim() : undefined,
            coverImage: coverImage || "",
            tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
            readTime: readTime || undefined,
            slug: slug ? slug.trim() : undefined,
            isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
        });

        const savedBlog = await blog.save();

        // Broadcast to newsletter subscribers asynchronously so post saving never hangs
        if (notifySubscribers) {
            Subscriber.find({ status: 'active' })
                .then((subscribers) => {
                    broadcastBlogEmail(savedBlog, subscribers, {
                        isUpcoming: isUpcoming !== undefined ? Boolean(isUpcoming) : !savedBlog.isPublished,
                        customSubject,
                        customNote,
                    }).catch((err) => console.error('[Broadcast Error on postBlog]:', err.message));
                })
                .catch((err) => console.error('[Subscribers Query Error on postBlog]:', err.message));
        }

        res.status(201).json({
            success: true,
            message: notifySubscribers
                ? (savedBlog.isPublished ? 'Post published & newsletter subscribers notified!' : 'Post created & upcoming preview broadcasted!')
                : 'Blog created successfully',
            savedBlog,
            blog: savedBlog,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A blog with this slug already exists",
            });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        console.error("Error in postBlog controller:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

// PUT update blog (Admin protected)
export async function updateBlog(req, res) {
    try {
        const { id } = req.params;

        // CastError check
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid blog ID format" });
        }

        const {
            title,
            content,
            excerpt,
            coverImage,
            tags,
            readTime,
            slug,
            isPublished,
            notifySubscribers,
            isUpcoming,
            customSubject,
            customNote,
        } = req.body;

        // Validation for fields being updated
        if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
            return res.status(400).json({ success: false, message: "Title must be a non-empty string" });
        }
        if (content !== undefined && (typeof content !== 'string' || !content.trim())) {
            return res.status(400).json({ success: false, message: "Content must be a non-empty string" });
        }
        if (tags !== undefined && !Array.isArray(tags)) {
            return res.status(400).json({ success: false, message: "Tags must be an array of strings" });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title.trim();
        if (content !== undefined) updateData.content = content.trim();
        if (excerpt !== undefined) updateData.excerpt = excerpt.trim();
        if (coverImage !== undefined) updateData.coverImage = coverImage;
        if (tags !== undefined) updateData.tags = tags.map(t => String(t).trim()).filter(Boolean);
        if (readTime !== undefined) updateData.readTime = readTime;
        if (slug !== undefined) updateData.slug = slug.trim();
        if (isPublished !== undefined) updateData.isPublished = Boolean(isPublished);

        const updatedBlog = await Blog.findByIdAndUpdate(
            id,
            updateData,
            {
                returnDocument: "after",
                runValidators: true,
            }
        );

        if (!updatedBlog) {
            return res.status(404).json({ success: false, message: "Blog not found" });
        }

        // Broadcast to newsletter subscribers asynchronously so post update never hangs
        if (notifySubscribers) {
            Subscriber.find({ status: 'active' })
                .then((subscribers) => {
                    broadcastBlogEmail(updatedBlog, subscribers, {
                        isUpcoming: isUpcoming !== undefined ? Boolean(isUpcoming) : !updatedBlog.isPublished,
                        customSubject,
                        customNote,
                    }).catch((err) => console.error('[Broadcast Error on updateBlog]:', err.message));
                })
                .catch((err) => console.error('[Subscribers Query Error on updateBlog]:', err.message));
        }

        res.status(200).json({
            success: true,
            message: notifySubscribers
                ? (updatedBlog.isPublished ? 'Post updated & newsletter subscribers notified!' : 'Post updated & upcoming preview broadcasted!')
                : 'Blog updated successfully',
            updatedBlog,
            blog: updatedBlog,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "A blog with this slug already exists",
            });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "Invalid blog ID format" });
        }
        console.error("Error in updateBlog controller:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}

// POST broadcast existing blog to subscribers (Admin protected)
export async function broadcastBlog(req, res) {
    try {
        const { id } = req.params;
        const { isUpcoming = false, customSubject = '', customNote = '' } = req.body;

        let blog = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
            blog = await Blog.findById(id);
        }
        if (!blog) {
            blog = await Blog.findOne({ slug: id });
        }

        if (!blog) {
            return res.status(404).json({ success: false, message: "Blog not found to broadcast" });
        }

        const subscribers = await Subscriber.find({ status: 'active' });
        if (subscribers.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No active subscribers found in database to broadcast to.",
                sentCount: 0,
                totalSubscribers: 0,
            });
        }

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Broadcast timed out. Note: On Render Free Tier, outgoing SMTP ports 25, 465, and 587 are blocked. Consider using an HTTP provider like Brevo or Resend.')), 10000)
        );

        const sentCount = await Promise.race([
            broadcastBlogEmail(blog, subscribers, {
                isUpcoming: Boolean(isUpcoming),
                customSubject,
                customNote,
            }),
            timeoutPromise,
        ]);

        return res.status(200).json({
            success: true,
            message: `Broadcast sent to ${sentCount} of ${subscribers.length} subscriber(s)!`,
            sentCount,
            totalSubscribers: subscribers.length,
            blogTitle: blog.title,
        });
    } catch (error) {
        console.error("Error in broadcastBlog controller:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to broadcast blog.",
        });
    }
}

// DELETE blog (Admin protected)
export async function deleteBlog(req, res) {
    try {
        const { id } = req.params;

        // CastError check
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid blog ID format" });
        }

        const deletedBlog = await Blog.findByIdAndDelete(id);

        if (!deletedBlog) {
            return res.status(404).json({ success: false, message: "Blog not found" });
        }

        res.status(200).json({
            success: true,
            message: "Blog deleted successfully!",
        });
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: "Invalid blog ID format" });
        }
        console.error("Error in deleteBlog controller:", error);
        res.status(500).json({ success: false, message: error.message || "Internal server error" });
    }
}
