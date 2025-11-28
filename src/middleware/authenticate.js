const { pool } = require("../config/db");

// AUTHENTICATION
async function authenticate(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ message: "Unauthorized" });

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const token = parts[1];

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE token = $1",
            [token]
        );

        const user = result.rows[0];
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        // Attach user to req so controllers can access it
        req.user = user;

        next();
    } catch (err) {
        console.error("Authentication error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

module.exports = { authenticate };
