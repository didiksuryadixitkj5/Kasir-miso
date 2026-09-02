import { Router, type IRouter } from "express";
import healthRouter from "./health";
import googleRouter from "./google";

const router: IRouter = Router();

router.use(healthRouter);
router.use(googleRouter);

export default router;
