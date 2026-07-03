// Upload/download de arquivos de material (guardados em blobs separados do quadro).
// POST /api/file   body JSON { id, name, type, dataB64 }  -> { url, name }
// GET  /api/file?url=<blobUrl>&name=<nomeDownload>         -> baixa o arquivo já com o nome escolhido
//
// Limite do POST: ~4.5MB de requisição (limite da função) => arquivo até ~3MB.

const { put } = require("@vercel/blob");

const BLOB_HOST = ".public.blob.vercel-storage.com";

function getBlobToken() {
  let t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) {
    const k = Object.keys(process.env).find((x) => x.endsWith("BLOB_READ_WRITE_TOKEN") || (x.includes("BLOB") && x.includes("TOKEN")));
    t = k ? process.env[k] : null;
  }
  if (!t) return null;
  return String(t).trim().replace(/^["']|["']$/g, "").trim() || null;
}

function lerJson(req) {
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
  const token = getBlobToken();
  if (!token) { res.status(503).json({ error: "blob-store-nao-configurado" }); return; }

  try {
    if (req.method === "GET") {
      const url = (req.query && req.query.url) || "";
      const name = ((req.query && req.query.name) || "arquivo").replace(/[\r\n"]/g, "");
      if (!url || url.indexOf(BLOB_HOST) === -1) { res.status(400).json({ error: "url-invalida" }); return; }
      const r = await fetch(url);
      if (!r.ok) { res.status(404).json({ error: "nao-encontrado" }); return; }
      const buf = Buffer.from(await r.arrayBuffer());
      res.setHeader("content-type", r.headers.get("content-type") || "application/octet-stream");
      res.setHeader("content-disposition", 'attachment; filename="' + name + '"');
      res.setHeader("cache-control", "no-store");
      res.status(200).send(buf);
      return;
    }
    if (req.method === "POST") {
      const secret = process.env.BOARD_SECRET || "";
      if (secret && (req.headers["x-board-key"] || "") !== secret) { res.status(401).json({ error: "nao-autorizado" }); return; }
      const body = await lerJson(req);
      if (!body || !body.dataB64) { res.status(400).json({ error: "sem-arquivo" }); return; }
      const buf = Buffer.from(body.dataB64, "base64");
      const safe = String(body.name || "arquivo").replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = "files/" + String(body.id || "x") + "/" + safe;
      const { url } = await put(path, buf, {
        access: "public", token, addRandomSuffix: true,
        contentType: body.type || "application/octet-stream",
      });
      res.status(200).json({ url, name: body.name || safe });
      return;
    }
    res.status(405).json({ error: "metodo-nao-permitido" });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
