const express = require("express");
const router = express.Router();
// import { register } from "../controllers/authController";

router.get('/', (req, res) => {
  res.send('Server is running');
});


// router.post("/", register)



module.exports = router;
