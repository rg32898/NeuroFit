import { Router, type IRouter } from "express";
import adminRouter from "./admin";
import authRouter from "./auth";
import catalogueRouter from "./catalogue";
import healthRouter from "./health";
import profileRouter from "./profile";
import progressRouter from "./progress";
import reportsRouter from "./reports";
import subscriptionRouter from "./subscription";
import supportRouter from "./support";
import webhooksRouter from "./webhooks";
import workoutRouter from "./workout";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/profile", profileRouter);
router.use("/workout", workoutRouter);
router.use("/progress", progressRouter);
router.use("/subscription", subscriptionRouter);
router.use("/reports", reportsRouter);
router.use("/support", supportRouter);
router.use("/webhooks", webhooksRouter);
router.use("/admin", adminRouter);
router.use(catalogueRouter);

export default router;
