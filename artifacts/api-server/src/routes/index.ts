import { Router, type IRouter } from "express";
import healthRouter from "./health";
import linkCheckRouter from "./link-check";

const router: IRouter = Router();

router.use(healthRouter);
router.use(linkCheckRouter);

export default router;
