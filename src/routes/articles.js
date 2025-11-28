const url = require("url");
const fs = require("fs");

const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const { authenticate } = require("../middleware/authenticate");


const { createArticle } = require("../controllers/articleController");


router.get('/', (req, res) => {
  res.send('Server is running');
});

router.post("/", authenticate, upload, createArticle);




module.exports = router;
