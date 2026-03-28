import { Router, type IRouter } from "express";

const router: IRouter = Router();

const VERDIQ_API_BASE = "http://localhost:8000";

router.get("/score", async (req, res) => {
  const { ticker } = req.query;

  if (!ticker || typeof ticker !== "string") {
    res.status(400).json({ detail: "ticker query parameter is required" });
    return;
  }

  try {
    const upstream = await fetch(
      `${VERDIQ_API_BASE}/score?ticker=${encodeURIComponent(ticker)}`,
    );
    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to reach Verdiq Python API");
    res.status(502).json({ detail: "Failed to reach scoring service" });
  }
});

export default router;
