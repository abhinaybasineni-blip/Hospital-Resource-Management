import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import resourceRouter from "./resources";
import operationsRouter from "./operations";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(resourceRouter);
router.use(operationsRouter);
router.use(aiRouter);

export default router;
