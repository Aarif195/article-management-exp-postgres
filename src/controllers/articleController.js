const multer  = require('multer')
const path = require("path");
const { pool } = require("../config/db"); //  PostgreSQL pool 

const { authenticate } = require("../middleware/authenticate");

const { sendError } = require("../utils/helper");



// Allowed categories, tags, and status
const allowedCategories = ["Programming", "Technology", "Design", "Web Developement"];
const allowedStatuses = ["draft", "published", "achieve"];
const allowedTags = ["api", "node", "frontend", "backend"];


// CREATE ARTICLES (Express + multer)
async function createArticle(req, res) {
    // Authenticate user first
    const user = req.user;

    console.log("Creating article for user:", user?.username);

    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        // Build articleData from req.body, attempting JSON.parse where appropriate (matches original behavior)
        let articleData = {};
        const fields = {
            title: req.body.title,
            content: req.body.content,
            category: req.body.category,
            status: req.body.status,
            tags: req.body.tags
        };

        for (const fieldName in fields) {
            const value = fields[fieldName];
            if (value === undefined) continue;
            try {
                articleData[fieldName] = JSON.parse(value);
            } catch {
                articleData[fieldName] = value;
            }
        }

        // Handle uploaded file from multer
        let imagePath = null;
        if (req.file) {
            imagePath = `/uploads/${req.file.filename}`;
        }

        const { title, content, category, status, tags } = articleData;

        // === VALIDATIONS (unchanged) ===
        if (!title?.trim()) return sendError(res, "Title is required.");
        if (!content?.trim()) return sendError(res, "Content is required.");
        if (!category?.trim()) return sendError(res, "Category is required.");
        if (!allowedCategories.includes(category)) return sendError(res, "Invalid category provided.");
        if (!status?.trim()) return sendError(res, "Status is required.");
        if (!allowedStatuses.includes(status)) return sendError(res, "Invalid status provided.");
        if (!tags || tags.length === 0) return sendError(res, "At least one tag is required.");
        if (!tags.every(tag => allowedTags.includes(tag))) return sendError(res, "Invalid tag(s) provided.");
        if (!imagePath) return sendError(res, "Image upload is required.");

        // === Save new article in PostgreSQL ===
        const result = await pool.query(
            `INSERT INTO articles 
            (title, content, author, category, status, tags, image, likes, comments, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,0,'[]',NOW(),NOW())
            RETURNING *`,
            [title, content, user.username, category, status, tags, imagePath]
        );

        const newArticle = result.rows[0];

        return res.status(201).json({ message: "Article created successfully", article: newArticle });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
}


module.exports = { createArticle

}