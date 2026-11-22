import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

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
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

app.use("/api", router);

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
