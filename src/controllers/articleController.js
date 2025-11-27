const url = require("url");
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db"); //  PostgreSQL pool from db.js

const authController = require("../middleware/authenticate");
const { authenticate } = require("../middleware/authenticate");

const { sendError, generateFileName } = require("../utils/helper");

const { uploadsDir } = require("../uploads/upload")


