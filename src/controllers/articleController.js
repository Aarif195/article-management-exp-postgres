const multer = require('multer')
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

// UPDATE ARTICLE
async function updateArticle(req, res) {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    const updatedData = req.body;

    // VALIDATION
    if (updatedData.title !== undefined) {
        if (!updatedData.title.trim()) {
            return res.status(400).json({ error: "Title cannot be empty." });
        }
    }

    if (updatedData.content !== undefined) {
        if (!updatedData.content.trim()) {
            return res.status(400).json({ error: "Content cannot be empty." });
        }
    }

    if (updatedData.category !== undefined) {
        if (!updatedData.category.trim()) {
            return res.status(400).json({ error: "Category cannot be empty." });
        }
        if (!allowedCategories.includes(updatedData.category)) {
            return res.status(400).json({ error: "Invalid category." });
        }
    }

    if (updatedData.status !== undefined) {
        if (!updatedData.status.trim()) {
            return res.status(400).json({ error: "Status cannot be empty." });
        }
        if (!allowedStatuses.includes(updatedData.status)) {
            return res.status(400).json({ error: "Invalid status." });
        }
    }

    if (updatedData.tags !== undefined) {
        if (!Array.isArray(updatedData.tags) || updatedData.tags.length === 0) {
            return res.status(400).json({ error: "Tags must be a non-empty array." });
        }
        if (!updatedData.tags.every(t => allowedTags.includes(t))) {
            return res.status(400).json({ error: "Invalid tag(s)." });
        }
    }

    try {
        // Check existence + ownership
        const check = await pool.query("SELECT * FROM articles WHERE id = $1", [id]);
        const article = check.rows[0];

        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }

        if (article.author !== user.username) {
            return res.status(403).json({ message: "Forbidden: You can only update your own articles" });
        }

        // Build dynamic SQL
        const fields = [];
        const values = [];
        let i = 1;

        for (const key in updatedData) {
            fields.push(`${key} = $${i}`);
            values.push(updatedData[key]);
            i++;
        }

        values.push(id);

        const updateSql = `
            UPDATE articles
            SET ${fields.join(", ")}, updated_at = NOW()
            WHERE id = $${i}
            RETURNING *
        `;

        const result = await pool.query(updateSql, values);

        return res.status(200).json({
            message: "Update successfully",
            article: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

// LIKE ARTICLE ID
async function likeArticle(req, res) {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const id = parseInt(req.params.id, 10);

    try {
        const q = await pool.query("SELECT * FROM articles WHERE id = $1", [id]);
        const article = q.rows[0];

        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }

        if (String(article.author) !== String(user.username)) {
            return res.status(403).json({ message: "You are not allowed to like this article" });
        }

        const hasLikedColumn = Object.prototype.hasOwnProperty.call(article, "liked");
        const currentLiked = hasLikedColumn ? Boolean(article.liked) : false;

        let newLikes = Number(article.likes || 0);
        let newLiked = currentLiked;
        let message;

        if (currentLiked) {
            newLikes = Math.max(newLikes - 1, 0);
            newLiked = false;
            message = "Article unliked!";
        } else {
            newLikes = newLikes + 1;
            newLiked = true;
            message = "Article liked!";
        }

        let updated;
        if (hasLikedColumn) {
            updated = await pool.query(
                "UPDATE articles SET likes = $1, liked = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
                [newLikes, newLiked, id]
            );
        } else {
            updated = await pool.query(
                "UPDATE articles SET likes = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
                [newLikes, id]
            );
        }

        console.log({
            tokenUser: user.username,
            articleAuthor: article.author,
            articleLikes: article.likes,
            articleLiked: article.liked
        });

        return res.status(200).json({ message, article: updated.rows[0] });

    } catch (err) {
        console.error("likeArticle error:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

// add comment 
async function postComment(req, res) {
    try {
        // authenticate
        const user = req.user;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        // get ID from express route params
        const id = parseInt(req.params.id);

        // get comment text from body
        const { text } = req.body;

        if (!text || text.trim() === "") {
            return res.status(400).json({ message: "Comment text is required" });
        }

        // Get article from PostgreSQL
        const { rows } = await pool.query("SELECT * FROM articles WHERE id = $1", [id]);
        const article = rows[0];

        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }

        // PRIVATE: Only article author can comment
        const articleAuthor = (article.author || "").trim().toLowerCase();
        const tokenUser = (user.username || "").trim().toLowerCase();

        if (articleAuthor !== tokenUser) {
            return res.status(403).json({ message: "You can only comment on your own article" });
        }

        const newComment = {
            id: Date.now(),
            user: user.username,
            text,
            date: new Date().toISOString(),
            replies: []
        };

        const updatedComments = article.comments ? [...article.comments, newComment] : [newComment];

        await pool.query(
            "UPDATE articles SET comments = $1 WHERE id = $2 RETURNING *",
            [JSON.stringify(updatedComments), id]
        );

        return res.status(201).json(newComment);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal server error" });
    }
}

// get comments
 async function getComments(req, res) {
    try {
        const user = req.user;  
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const id = parseInt(req.params.id);

        const { rows } = await pool.query(
            "SELECT author, comments FROM articles WHERE id = $1",
            [id]
        );
        const article = rows[0];

        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }

        if (article.author !== user.username) {
            return res.status(403).json({
                message: "Forbidden: Access to comments is restricted to the article's author."
            });
        }

        const userComments = (article.comments || []).filter(
            c => c.user === user.username
        );

        if (userComments.length === 0) {
            return res.status(403).json({
                message: "Forbidden: You have not made any comments on this article."
            });
        }

        return res.status(200).json(userComments);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal server error" });
    }
}


// reply comment
async function replyComment(req, res) {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const articleId = parseInt(req.params.articleId, 10);
    const commentId = parseInt(req.params.commentId, 10);
    const { text } = req.body;

    if (!text || text.trim() === "") {
        return res.status(400).json({ message: "Reply text is required" });
    }

    try {
        // Fetch article from Postgres
        const articleResult = await pool.query(
            "SELECT * FROM articles WHERE id = $1",
            [articleId]
        );
        const article = articleResult.rows[0];

        if (!article) {
            return res.status(404).json({ message: "Article not found" });
        }

        // STRICT PRIVATE: only article owner can act
        if (article.author !== user.username) {
            return res.status(403).json({
                message: "Forbidden: Only the article owner can perform this action"
            });
        }

        const comments = article.comments || [];
        const commentIndex = comments.findIndex(c => c.id === commentId);

        if (commentIndex === -1) {
            return res.status(404).json({ message: "Comment not found" });
        }

        const reply = {
            id: Date.now(),
            user: user.username,
            text,
            date: new Date().toISOString()
        };

        comments[commentIndex].replies = comments[commentIndex].replies || [];
        comments[commentIndex].replies.push(reply);

        // Update article in Postgres
        await pool.query(
            "UPDATE articles SET comments = $1 WHERE id = $2",
            [JSON.stringify(comments), articleId]
        );

        return res.status(201).json(reply);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server error" });
    }
}


module.exports = {
    createArticle, getArticles, getArticleById
    , deleteArticle, updateArticle, likeArticle, postComment, getComments, replyComment
}