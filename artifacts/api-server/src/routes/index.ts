import { Router, type IRouter } from "express";
import healthRouter from "./health";
import linkCheckRouter from "./link-check";
import whatsappRouter from "./whatsapp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(linkCheckRouter);
router.use(whatsappRouter);

export default router;
