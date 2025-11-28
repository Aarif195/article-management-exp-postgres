const express = require("express");
const port = process.env.PORT || 5000;
const app = express();
require('dotenv').config();

const authRouter = require("./src/routes/auth");
const articlesRouter = require("./src/routes/articles");


app.use(express.json());

app.use("/auth", authRouter);
app.use("/articles", articlesRouter);



app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
