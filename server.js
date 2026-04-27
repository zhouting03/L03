const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const MESSAGE_FILE = path.join(DATA_DIR, 'messages.json');
const DELETED_FILE = path.join(DATA_DIR, 'deleted.json');

async function ensureDataFiles() {
    await fs.mkdir(DATA_DIR, { recursive: true });

    await Promise.all([MESSAGE_FILE, DELETED_FILE].map(async (filePath) => {
        try {
            await fs.access(filePath);
        } catch {
            await fs.writeFile(filePath, '[]', 'utf8');
        }
    }));
}

async function readJsonArray(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeJsonArray(filePath, value) {
    const data = Array.isArray(value) ? value : [];
    await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    return data;
}

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end(JSON.stringify(payload));
}

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') return 'text/html; charset=utf-8';
    if (ext === '.css') return 'text/css; charset=utf-8';
    if (ext === '.js') return 'application/javascript; charset=utf-8';
    if (ext === '.json') return 'application/json; charset=utf-8';
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.svg') return 'image/svg+xml';
    return 'application/octet-stream';
}

async function readRequestBody(req) {
    return await new Promise((resolve, reject) => {
        const chunks = [];

        req.on('data', (chunk) => {
            chunks.push(chunk);
        });

        req.on('end', () => {
            if (!chunks.length) {
                resolve('');
                return;
            }
            resolve(Buffer.concat(chunks).toString('utf8'));
        });

        req.on('error', reject);
    });
}

async function handleCollection(req, res, filePath) {
    if (req.method === 'GET') {
        sendJson(res, 200, await readJsonArray(filePath));
        return true;
    }

    if (req.method === 'POST') {
        const body = await readRequestBody(req);
        let payload = [];

        if (body) {
            try {
                payload = JSON.parse(body);
            } catch {
                sendJson(res, 400, { error: 'invalid json' });
                return true;
            }
        }

        const saved = await writeJsonArray(filePath, payload);
        sendJson(res, 200, saved);
        return true;
    }

    sendJson(res, 405, { error: 'method not allowed' });
    return true;
}

async function serveStaticFile(req, res, pathname) {
    const relativePath = pathname === '/' ? '/index.html' : pathname;

    if (relativePath.includes('..')) {
        sendJson(res, 400, { error: 'bad request' });
        return;
    }

    const filePath = path.join(ROOT_DIR, relativePath);

    try {
        const fileStat = await fs.stat(filePath);
        if (!fileStat.isFile()) {
            throw new Error('not a file');
        }

        const content = await fs.readFile(filePath);
        res.writeHead(200, {
            'Content-Type': getContentType(filePath),
            'Cache-Control': 'no-store'
        });
        res.end(content);
    } catch {
        sendJson(res, 404, { error: 'not found' });
    }
}

async function main() {
    await ensureDataFiles();

    const server = http.createServer(async (req, res) => {
        const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

        if (requestUrl.pathname === '/api/messages') {
            await handleCollection(req, res, MESSAGE_FILE);
            return;
        }

        if (requestUrl.pathname === '/api/deleted') {
            await handleCollection(req, res, DELETED_FILE);
            return;
        }

        await serveStaticFile(req, res, requestUrl.pathname);
    });

    server.listen(PORT, () => {
        console.log(`Message board server running at http://localhost:${PORT}`);
    });
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});