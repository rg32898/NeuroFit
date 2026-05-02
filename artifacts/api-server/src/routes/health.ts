import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    version: process.env["npm_package_version"] ?? "0.0.0",
  });
});

export default router;
