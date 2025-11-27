const express = require("express");
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config();
const articlesRouter = require("./routes/articles");


app.use(express.json());
app.use("/articles", articlesRouter);


app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
