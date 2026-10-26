import mongoose from 'mongoose';
import Blog from '../models/Blog.js';

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

        res.status(201).json({
            success: true,
            message: 'Blog created successfully',
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

        res.status(200).json({
            success: true,
            message: 'Blog updated successfully',
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
