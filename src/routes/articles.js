const url = require("url");
const fs = require("fs");

const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const { authenticate } = require("../middleware/authenticate");


const { createArticle, getArticles, getArticleById, deleteArticle , updateArticle, likeArticle, postComment} = require("../controllers/articleController");


// router.get('/', (req, res) => {
//   res.send('Server is running');
// });

router.post("/", authenticate, upload, createArticle);
router.get("/", getArticles);
router.get("/:id", getArticleById);
router.delete("/:id", authenticate, deleteArticle);
router.patch("/:id", authenticate, updateArticle);
router.post("/:id/like",authenticate, likeArticle);
router.post("/:id/comments", authenticate, postComment);








module.exports = router;
