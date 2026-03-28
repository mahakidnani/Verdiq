import { Router, type IRouter } from "express";
import healthRouter from "./health";
import scoreRouter from "./score";

const router: IRouter = Router();

router.use(healthRouter);
router.use(scoreRouter);

export default router;
