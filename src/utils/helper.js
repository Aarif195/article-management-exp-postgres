function sendError(res, msg) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: msg }));
}

function generateFileName(originalName) {
    const timestamp = Date.now();
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    return `${base}-${timestamp}${ext}`;
}

module.exports = {
    sendError, generateFileName
}