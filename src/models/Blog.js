import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
        },
        slug: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            lowercase: true,
        },
        content: {
            type: String,
            required: [true, "Content is required"],
        },
        excerpt: {
            type: String,
            trim: true,
            default: "",
        },
        coverImage: {
            type: String,
            default: "",
        },
        tags: {
            type: [String],
            default: [],
        },
        readTime: {
            type: String,
            default: "",
        },
        isPublished: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

// Auto-generate slug, excerpt, and readTime before saving if not provided
blogSchema.pre("save", function (next) {
    if (!this.slug && this.title) {
        this.slug = this.title
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "");
    }

    if (!this.excerpt && this.content) {
        // Strip markdown/html characters roughly for excerpt
        const plainText = this.content.replace(/[#*`_~\[\]]/g, "").trim();
        this.excerpt = plainText.length > 160 ? plainText.substring(0, 157) + "..." : plainText;
    }

    if (!this.readTime && this.content) {
        const wordCount = this.content.trim().split(/\s+/).filter(Boolean).length;
        const minutes = Math.max(1, Math.ceil(wordCount / 200));
        this.readTime = `${minutes} min read`;
    }

    next();
});

const Blog = mongoose.model("Blog", blogSchema);
export default Blog;