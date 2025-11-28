const url = require("url");
const fs = require("fs");

const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const { authenticate } = require("../middleware/authenticate");


const { createArticle, getArticles, getArticleById, deleteArticle , updateArticle, likeArticle, postComment, getComments, replyComment, likeComment, likeReply} = require("../controllers/articleController");



router.post("/", authenticate, upload, createArticle);
router.get("/", getArticles);
router.get("/:id", getArticleById);
router.delete("/:id", authenticate, deleteArticle);
router.patch("/:id", authenticate, updateArticle);
router.post("/:id/like",authenticate, likeArticle);
router.post("/:id/comments", authenticate, postComment);
router.get("/:id/comments", authenticate, getComments);
router.post("/:articleId/comments/:commentId/reply", authenticate, replyComment);
router.post("/:articleId/comments/:commentId/like", authenticate, likeComment);
router.post("/:articleId/comments/:commentId/replies/:replyId/like", authenticate, likeReply);










module.exports = router;
