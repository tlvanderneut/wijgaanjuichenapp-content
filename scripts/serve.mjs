import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4174);
const roots = {
  "/": "site/index.html",
  "/privacy.html": "site/privacy.html",
  "/support.html": "site/support.html",
  "/data/wk-2026.json": "data/wk-2026.json"
};
const types = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8" };

createServer((request, response) => {
  const relativePath = roots[request.url?.split("?")[0]];
  if (!relativePath) {
    response.writeHead(404).end("Not found");
    return;
  }

  const file = normalize(join(process.cwd(), relativePath));
  response.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Type": types[extname(file)] || "application/octet-stream"
  });
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Content beschikbaar op http://127.0.0.1:${port}`);
});
