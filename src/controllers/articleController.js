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

        //  Save new article in PostgreSQL 
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

// GET ALL ARTICLES
async function getArticles(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, parseInt(req.query.limit) || 10);
        const offset = (page - 1) * limit;

        const filters = { ...req.query };

        // Validate filters
        for (const key in filters) {
            const value = filters[key].toLowerCase();
            if (!["page", "limit", "category", "status", "tags", "search"].includes(key)) {
                return res.status(400).json({ error: `Invalid query key: ${key}` });
            }

            if (key === "category" && !allowedCategories.map(c => c.toLowerCase()).includes(value)) {
                return res.json({ totalData: 0, totalPages: 0, currentPage: page, limit, data: [] });
            }
            if (key === "status" && !allowedStatuses.map(s => s.toLowerCase()).includes(value)) {
                return res.json({ totalData: 0, totalPages: 0, currentPage: page, limit, data: [] });
            }
            if (key === "tags" && !allowedTags.map(t => t.toLowerCase()).includes(value)) {
                return res.json({ totalData: 0, totalPages: 0, currentPage: page, limit, data: [] });
            }
        }

        // Build SQL query
        let query = `SELECT * FROM articles`;
        const values = [];
        const conditions = [];

        if (filters.search) {
            values.push(`%${filters.search}%`);
            conditions.push(`(LOWER(title) LIKE $${values.length} OR LOWER(content) LIKE $${values.length})`);
        }
        if (filters.category) {
            values.push(filters.category);
            conditions.push(`LOWER(category) = LOWER($${values.length})`);
        }
        if (filters.status) {
            values.push(filters.status);
            conditions.push(`LOWER(status) = LOWER($${values.length})`);
        }
        if (filters.tags) {
            values.push(filters.tags);
            conditions.push(`$${values.length} = ANY(tags)`);
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(" AND ");
        }

        // Total count for pagination
        const countResult = await pool.query(query.replace("*", "COUNT(*) AS total"), values);
        const totalData = parseInt(countResult.rows[0].total, 10);
        const totalPages = totalData === 0 ? 0 : Math.ceil(totalData / limit);

        // Apply sorting, limit, and offset
        query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
        values.push(limit, offset);

        const result = await pool.query(query, values);
        const dataSlice = result.rows;

        res.status(200).json({
            totalData,
            totalPages,
            currentPage: page,
            limit,
            data: dataSlice
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
}

// GET article by ID
async function getArticleById(req, res) {
    const id = parseInt(req.params.id);

    try {
        const result = await pool.query("SELECT * FROM articles WHERE id = $1", [id]);
        const article = result.rows[0];

        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }

        res.status(200).json(article);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
}

// DELETE ARTICLE
async function deleteArticle(req, res) {
    const user = req.user;

    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);

    try {
        // Check if the article exists
        const { rows } = await pool.query("SELECT * FROM articles WHERE id = $1", [id]);
        const article = rows[0];

        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }

        // Verify author
        if (article.author !== user.username) {
            return res.status(403).json({ message: "Forbidden: You can only delete your own articles" });
        }

        // Delete the article
        const deleted = await pool.query("DELETE FROM articles WHERE id = $1 RETURNING *", [id]);

        res.status(204)
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
}



module.exports = { createArticle, getArticles, getArticleById
,deleteArticle
}