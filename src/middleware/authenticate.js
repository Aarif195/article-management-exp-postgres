const { pool } = require("../config/db");

// AUTHENTICATION
async function authenticate(req) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return null;

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0] !== "Bearer") return null;

    const token = parts[1];

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE token = $1",
            [token]
        );
        const user = result.rows[0];
        return user || null;
    } catch (err) {
        console.error("Authentication error:", err);
        return null;
    }
}


module.exports = { authenticate };
