// Pauta - servidor local: entrega o app (pasta dist) e guarda as tarefas em data/pauta.json,
// para o PC e o celular (via Tailscale) usarem a mesma lista.
// Uso: npm run build && npm run serve   ->  http://127.0.0.1:4321
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync, copyFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT) || 4321;
const ROOT = import.meta.dirname;
const DIST = path.join(ROOT, "dist");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "pauta.json");
const MAX_BODY = 10 * 1024 * 1024;

/** @type {{ rev: number, state: unknown }} */
let db = loadDb();

function loadDb() {
  try {
    const parsed = JSON.parse(readFileSync(DB_FILE, "utf8"));
    if (typeof parsed.rev === "number") return parsed;
  } catch {
    /* ainda não existe */
  }
  return { rev: 0, state: null };
}

function saveDb() {
  mkdirSync(DATA_DIR, { recursive: true });
  // Guarda a versão anterior como cópia de segurança.
  if (existsSync(DB_FILE)) copyFileSync(DB_FILE, DB_FILE + ".bak");
  const tmp = DB_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(db));
  renameSync(tmp, DB_FILE);
}

const isState = (v) => !!v && Array.isArray(v.contexts) && Array.isArray(v.tasks);

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  if (pathname === "/api/health") return sendJson(res, 200, { ok: true });
  if (pathname !== "/api/state") return sendJson(res, 404, { error: "not found" });

  if (req.method === "GET") return sendJson(res, 200, db);

  if (req.method === "PUT") {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { error: "invalid body" });
    }
    if (!isState(body?.state)) return sendJson(res, 400, { error: "invalid state" });
    // Outro aparelho gravou antes: devolve a versão atual para o app mesclar.
    if (body.baseRev !== db.rev) return sendJson(res, 409, db);
    db = { rev: db.rev + 1, state: body.state };
    try {
      saveDb();
    } catch (err) {
      console.error("Falha ao salvar:", err);
      return sendJson(res, 500, { error: "save failed" });
    }
    return sendJson(res, 200, { rev: db.rev });
  }

  res.writeHead(405).end();
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
  if (!file.startsWith(DIST)) return res.writeHead(403).end();
  if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  if (!existsSync(file)) return res.writeHead(503).end("Rode npm run build primeiro.");

  const rel = path.relative(DIST, file).replaceAll("\\", "/");
  const cache = rel.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache";
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": cache,
  });
  res.end(req.method === "HEAD" ? undefined : readFileSync(file));
}

http
  .createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url ?? "/", "http://localhost");
      if (pathname.startsWith("/api/")) return await handleApi(req, res, pathname);
      if (req.method !== "GET" && req.method !== "HEAD") return res.writeHead(405).end();
      serveStatic(req, res, pathname);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  })
  .listen(PORT, HOST, () => console.log(`Pauta em http://${HOST}:${PORT}`));
