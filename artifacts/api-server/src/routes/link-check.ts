import { Router, type IRouter } from "express";
import {
  CheckLinkBody,
  CheckLinkResponse,
} from "@workspace/api-zod";
import rateLimit from "express-rate-limit";
import {
  analyzeLink,
} from "../lib/link-analysis-service";
import { LinkAnalysisInputError } from "../lib/link-analysis";

const router: IRouter = Router();

const checkLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res): void => {
    const language = req.body?.language === "ar" ? "ar" : "en";
    res.status(429).json({
      code: "rate_limited",
      message:
        language === "ar"
          ? "تم تجاوز عدد المحاولات المسموح بها. انتظر دقيقة ثم حاول مجدداً."
          : "Too many checks. Wait a minute and try again.",
    });
  },
});

router.post("/check", checkLimiter, async (req, res): Promise<void> => {
  const input = CheckLinkBody.safeParse(req.body);
  if (!input.success) {
    const language = req.body?.language === "ar" ? "ar" : "en";
    res.status(400).json({
      code: "invalid_request",
      message:
        language === "ar"
          ? "تحقق من الرابط واللغة والرسالة ثم حاول مجدداً."
          : "Check the URL, language, and message, then try again.",
    });
    return;
  }

  try {
    const result = CheckLinkResponse.parse(await analyzeLink(input.data));
    if (result.aiAnalysis.status === "unavailable") {
      req.log.warn("AI message analysis unavailable; returning domain findings.");
    }
    res.json(result);
  } catch (error) {
    if (error instanceof LinkAnalysisInputError) {
      res.status(400).json({
        code: error.code,
        message: error.message,
      });
      return;
    }

    req.log.error("Link analysis failed.");
    res.status(500).json({
      code: "analysis_failed",
      message:
        input.data.language === "ar"
          ? "تعذّر إكمال الفحص. حاول مجدداً لاحقاً."
          : "The check could not be completed. Try again later.",
    });
  }
});

export default router;
