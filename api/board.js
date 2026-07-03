// Backend do quadro — lê/grava o estado inteiro num único blob JSON (Vercel Blob).
// GET  /api/board  -> { data: <estado> | null }
// POST /api/board  (body = estado) -> { ok: true }
//
// Requer a env BLOB_READ_WRITE_TOKEN (criada automaticamente ao conectar um
// Blob store ao projeto). Opcional: BOARD_SECRET — se definida, exige o header
// x-board-key igual pra ler/gravar (proteção "leve", igual ao portão de senha).

const { put, list } = require("@vercel/blob");

const KEY = "board.json";

// A Vercel às vezes cria o token com prefixo (ex.: lowt_blob_BLOB_READ_WRITE_TOKEN).
// Procuramos qualquer env que termine em BLOB_READ_WRITE_TOKEN.
function getBlobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const k = Object.keys(process.env).find((x) => x.endsWith("BLOB_READ_WRITE_TOKEN") || (x.includes("BLOB") && x.includes("TOKEN")));
  return k ? process.env[k] : null;
}

function lerBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") { try { return Promise.resolve(JSON.parse(req.body)); } catch (e) { return Promise.resolve(null); } }
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => { try { resolve(JSON.parse(raw)); } catch (e) { resolve(null); } });
    req.on("error", () => resolve(null));
  });
}

module.exports = async (req, res) => {
  const secret = process.env.BOARD_SECRET || "";
  if (secret) {
    const provided = req.headers["x-board-key"] || "";
    if (provided !== secret) { res.status(401).json({ error: "nao-autorizado" }); return; }
  }
  const token = getBlobToken();
  if (!token) {
    const blobKeys = Object.keys(process.env).filter((x) => x.includes("BLOB"));
    res.status(503).json({ error: "blob-store-nao-configurado", envBlobKeys: blobKeys });
    return;
  }

  try {
    if (req.method === "GET") {
      const { blobs } = await list({ prefix: KEY, limit: 1, token });
      res.setHeader("cache-control", "no-store");
      if (!blobs.length) { res.status(200).json({ data: null }); return; }
      const r = await fetch(blobs[0].url + "?t=" + Date.now(), { cache: "no-store" });
      const data = await r.json();
      res.status(200).json({ data });
      return;
    }
    if (req.method === "POST") {
      const body = await lerBody(req);
      if (!body || typeof body !== "object") { res.status(400).json({ error: "body-invalido" }); return; }
      await put(KEY, JSON.stringify(body), {
        access: "public", token, addRandomSuffix: false, allowOverwrite: true,
        contentType: "application/json", cacheControlMaxAge: 0,
      });
      res.status(200).json({ ok: true });
      return;
    }
    res.status(405).json({ error: "metodo-nao-permitido" });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
