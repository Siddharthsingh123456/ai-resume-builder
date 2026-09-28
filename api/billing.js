const authApp = require("./auth.js");
const requireAuth = authApp.requireAuth;
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(requireAuth);

app.post("/api/billing", async (req, res) => {
  const plan = req.body?.plan === "team" ? "team" : "pro";
  const key = process.env.STRIPE_SECRET_KEY;
  const price =
    plan === "team"
      ? process.env.STRIPE_TEAM_PRICE_ID
      : process.env.STRIPE_PRO_PRICE_ID;

  if (!key || !price) {
    return res.json({
      message:
        "Stripe checkout is payment-ready. Add STRIPE_SECRET_KEY and the matching price ID in Vercel to activate live payments.",
    });
  }

  try {
    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url:
        process.env.BILLING_SUCCESS_URL ||
        "https://ai-resume-builder-rho-sandy.vercel.app/?billing=success",
      cancel_url:
        process.env.BILLING_CANCEL_URL ||
        "https://ai-resume-builder-rho-sandy.vercel.app/?billing=cancel",
    });

    const response = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(key + ":").toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Stripe error");
    }

    return res.json({ url: data.url });
  } catch (error) {
    console.error("BILLING ERROR:", error);
    return res.status(500).json({ error: error.message || "Billing failed" });
  }
});

module.exports = app;
