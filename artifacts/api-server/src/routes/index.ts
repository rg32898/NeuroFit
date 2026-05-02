import { Router, type IRouter } from "express";
import authRouter from "./auth";
import catalogueRouter from "./catalogue";
import healthRouter from "./health";
import profileRouter from "./profile";
import workoutRouter from "./workout";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/profile", profileRouter);
router.use("/workout", workoutRouter);
router.use(catalogueRouter);

export default router;
