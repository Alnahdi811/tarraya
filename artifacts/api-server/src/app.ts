import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const app: Express = express();
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb", parameterLimit: 100 }));

app.use("/api", router);

// Optional fresh-clone mode: serve the built web checker and API on one origin.
// Replit normally serves these through its artifact router; that stays unchanged.
if (process.env.SERVE_WEB === "1") {
  const webDirectory = fileURLToPath(new URL("../../tarraya/dist/public/", import.meta.url));
  const indexFile = fileURLToPath(new URL("../../tarraya/dist/public/index.html", import.meta.url));
  if (!existsSync(indexFile)) {
    throw new Error("Built web checker not found. Build @workspace/tarraya before using SERVE_WEB=1.");
  }
  app.use("/api", (_req, res): void => {
    res.status(404).json({ code: "not_found", message: "Unknown API endpoint." });
  });
  app.use(express.static(webDirectory));
  app.get("/{*path}", (_req, res): void => { res.sendFile(indexFile); });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction): void => {
  const type =
    typeof error === "object" && error !== null && "type" in error
      ? error.type
      : undefined;
  if (type === "entity.too.large") {
    res.status(413).json({
      code: "request_too_large",
      message: "Request body exceeds the 16 KB limit.",
    });
    return;
  }
  if (type === "entity.parse.failed") {
    res.status(400).json({
      code: "invalid_json",
      message: "Request body must contain valid JSON.",
    });
    return;
  }
  res.status(500).json({
    code: "service_error",
    message: "The service could not process this request.",
  });
});

export default app;
