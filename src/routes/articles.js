const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const { authenticate } = require("../middleware/authenticate");


const { createArticle, getArticles, getArticleById, deleteArticle , updateArticle, likeArticle, postComment, getComments, replyComment, likeComment, likeReply, editCommentOrReply, deleteCommentOrReply, getMyArticles} = require("../controllers/articleController");


router.post("/", authenticate, upload, createArticle);
router.get("/my-articles", authenticate, getMyArticles);
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
router.put("/:articleId/comments/:commentId", authenticate, editCommentOrReply);
router.put("/:articleId/comments/:commentId/replies/:replyId", authenticate, editCommentOrReply);

router.delete("/:articleId/comments/:commentId", authenticate, deleteCommentOrReply);

router.delete("/:articleId/comments/:commentId/replies/:replyId", authenticate, deleteCommentOrReply);



module.exports = router;
