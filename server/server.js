import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import crypto from "node:crypto";

const app = express();
const PORT = Number(process.env.PORT || 10000);
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-terra";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

const allowedOrigins = new Set(
  (process.env.HONEYCOMB_ALLOWED_ORIGINS ||
    "https://arriii.github.io,http://localhost:8000,http://127.0.0.1:8000")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean)
);

app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false
}));

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Honeycomb-Session"]
}));

app.use(express.json({ limit: "12mb" }));

// Small in-memory abuse guard. This is only a prototype layer.
const rateBuckets = new Map();
function rateLimit(req, res, next) {
  const key = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const limit = 20;
  const bucket = rateBuckets.get(key) || { count: 0, start: now };

  if (now - bucket.start > windowMs) {
    bucket.count = 0;
    bucket.start = now;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);

  if (bucket.count > limit) {
    return res.status(429).json({ error: "Too many scan requests. Please wait a few minutes and try again." });
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "honeycomb-brain",
    model: MODEL,
    openaiConfigured: Boolean(OPENAI_API_KEY)
  });
});

const scanSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "identification",
    "image_quality",
    "visible_text",
    "visible_person_context",
    "research",
    "profile_analysis",
    "memory_analysis",
    "conversation",
    "limitations"
  ],
  properties: {
    identification: {
      type: "object",
      additionalProperties: false,
      required: ["status","product_name","brand","variant","category","confidence","barcode"],
      properties: {
        status: { type: "string", enum: ["identified","probable","insufficient"] },
        product_name: { type: "string" },
        brand: { type: "string" },
        variant: { type: "string" },
        category: { type: "string" },
        confidence: { type: "integer", minimum: 0, maximum: 100 },
        barcode: { type: "string" }
      }
    },
    image_quality: {
      type: "object",
      additionalProperties: false,
      required: ["quality","blurry","glare","cropped","notes"],
      properties: {
        quality: { type: "string", enum: ["good","usable","limited"] },
        blurry: { type: "boolean" },
        glare: { type: "boolean" },
        cropped: { type: "boolean" },
        notes: { type: "string" }
      }
    },
    visible_text: {
      type: "array",
      items: { type: "string" }
    },
    visible_person_context: {
      type: "object",
      additionalProperties: false,
      required: ["person_visible","non_diagnostic_observations"],
      properties: {
        person_visible: { type: "boolean" },
        non_diagnostic_observations: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    research: {
      type: "object",
      additionalProperties: false,
      required: ["performed_web_search","ingredient_text","ingredients","manufacturer_notes","research_summary"],
      properties: {
        performed_web_search: { type: "boolean" },
        ingredient_text: { type: "string" },
        ingredients: {
          type: "array",
          items: { type: "string" }
        },
        manufacturer_notes: { type: "string" },
        research_summary: { type: "string" }
      }
    },
    profile_analysis: {
      type: "object",
      additionalProperties: false,
      required: [
        "known_matches",
        "watching_matches",
        "avoid_matches",
        "tolerated_matches",
        "conclusion",
        "explanation"
      ],
      properties: {
        known_matches: { type: "array", items: { type: "string" } },
        watching_matches: { type: "array", items: { type: "string" } },
        avoid_matches: { type: "array", items: { type: "string" } },
        tolerated_matches: { type: "array", items: { type: "string" } },
        conclusion: {
          type: "string",
          enum: ["conflict","closer_look","no_identified_conflict","insufficient"]
        },
        explanation: { type: "string" }
      }
    },
    memory_analysis: {
      type: "object",
      additionalProperties: false,
      required: ["previous_scan_matches","chat_matches","reaction_matches","summary"],
      properties: {
        previous_scan_matches: { type: "array", items: { type: "string" } },
        chat_matches: { type: "array", items: { type: "string" } },
        reaction_matches: { type: "array", items: { type: "string" } },
        summary: { type: "string" }
      }
    },
    conversation: {
      type: "object",
      additionalProperties: false,
      required: ["opening_message","follow_up_question"],
      properties: {
        opening_message: { type: "string" },
        follow_up_question: { type: "string" }
      }
    },
    limitations: {
      type: "array",
      items: { type: "string" }
    }
  }
};

function trimArray(value, maxItems = 12) {
  return Array.isArray(value) ? value.slice(-maxItems) : [];
}

function sanitizeContext(body) {
  return {
    mode: String(body.mode || "Auto").slice(0, 40),
    profile: {
      known: String(body.profile?.known || "").slice(0, 3000),
      suspected: String(body.profile?.suspected || "").slice(0, 3000),
      avoid: String(body.profile?.avoid || "").slice(0, 3000),
      tolerated: String(body.profile?.tolerated || "").slice(0, 3000),
      synopsis: String(body.profile?.synopsis || "").slice(0, 3500)
    },
    recentScans: trimArray(body.recentScans, 10).map(item => ({
      productName: String(item?.productName || "").slice(0, 180),
      productBrand: String(item?.productBrand || "").slice(0, 120),
      summary: String(item?.summary || "").slice(0, 500),
      ingredients: String(item?.ingredients || "").slice(0, 1200),
      time: String(item?.time || "").slice(0, 80)
    })),
    recentReactions: trimArray(body.recentReactions, 10).map(item => ({
      note: String(item?.note || "").slice(0, 700),
      exposure: String(item?.exposure || "").slice(0, 300),
      severity: Number(item?.severity || 0),
      time: String(item?.time || "").slice(0, 80)
    })),
    recentChat: trimArray(body.recentChat, 12).map(item => ({
      role: item?.role === "user" ? "user" : "ai",
      text: String(item?.text || "").slice(0, 900),
      time: String(item?.time || "").slice(0, 80)
    }))
  };
}

function getOutputText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  for (const item of response.output || []) {
    if (item?.type !== "message") continue;
    for (const part of item.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }
  return "";
}

function extractSources(response) {
  const seen = new Set();
  const sources = [];

  function add(url, title = "") {
    if (!url || seen.has(url)) return;
    seen.add(url);
    sources.push({ url, title: title || url });
  }

  for (const item of response.output || []) {
    if (item?.type === "web_search_call") {
      for (const source of item?.action?.sources || []) {
        add(source?.url, source?.title || source?.name || "");
      }
    }

    if (item?.type === "message") {
      for (const part of item.content || []) {
        for (const annotation of part?.annotations || []) {
          if (annotation?.type === "url_citation") {
            add(annotation?.url, annotation?.title || "");
          }
        }
      }
    }
  }

  return sources.slice(0, 12);
}

function buildPrompt(context) {
  return `
You are the analysis engine for Honeycomb, a personal exposure-intelligence prototype.

GOAL
Inspect the image, identify the probable product or item, use web search when it materially improves identification or product/ingredient verification, compare verified information against the user's Honeycomb context, and produce a cautious conversational result.

SEARCH BEHAVIOR
- If a brand/product/variant is visible or reasonably inferable, search the web for the exact item.
- Prefer manufacturer pages first, then authoritative product databases or established retailers.
- Verify ingredient information with a source when possible.
- If the exact product cannot be verified, say so.
- Never invent ingredients, barcodes, product names, prior memories, or sources.

HEALTH / SAFETY BEHAVIOR
- Never diagnose a skin condition, allergy, or disease from the image.
- If a person or visible skin is in the image, you may describe only simple visible, non-diagnostic observations such as "a visibly red area appears near the mouth" when genuinely visible.
- Do not infer a medical condition from appearance.
- A condition in the user's synopsis is user-reported context, not something the image confirms.
- "No identified conflict" is allowed only when product/ingredient evidence is reasonably verified and there is no saved-profile match. Otherwise use "closer_look" or "insufficient".
- Distinguish known allergies, suspected/watching items, personal avoids, and tolerated history.
- Past tolerance does not guarantee future tolerance.
- A profile match does not prove that the item caused any symptom.

MEMORY BEHAVIOR
- Use only the recent scans, reactions, and chat supplied below.
- If this looks like a previous item or topic, mention that naturally.
- Do not claim a previous scan/chat unless the supplied memory actually supports it.

USER CONTEXT
${JSON.stringify(context, null, 2)}

Return only the structured result requested by the response schema.
`.trim();
}

app.post("/api/analyze-scan", rateLimit, async (req, res) => {
  if (!OPENAI_API_KEY) {
    return res.status(503).json({
      error: "Honeycomb Brain is not configured yet.",
      code: "OPENAI_NOT_CONFIGURED"
    });
  }

  const imageDataUrl = String(req.body?.imageDataUrl || "");
  if (!imageDataUrl.startsWith("data:image/")) {
    return res.status(400).json({ error: "A base64 image data URL is required." });
  }
  if (imageDataUrl.length > 10_500_000) {
    return res.status(413).json({ error: "Image is too large." });
  }

  const context = sanitizeContext(req.body || {});
  const sessionRaw = String(req.headers["x-honeycomb-session"] || "anonymous");
  const safetyIdentifier = crypto.createHash("sha256").update(sessionRaw).digest("hex").slice(0, 64);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        store: false,
        safety_identifier: safetyIdentifier,
        tools: [{ type: "web_search" }],
        include: ["web_search_call.action.sources"],
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: buildPrompt(context) },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high"
            }
          ]
        }],
        text: {
          format: {
            type: "json_schema",
            name: "honeycomb_scan_analysis",
            strict: true,
            schema: scanSchema
          }
        }
      })
    });

    const raw = await response.json();

    if (!response.ok) {
      console.error("OpenAI request failed:", raw?.error?.type || response.status);
      return res.status(502).json({
        error: "Honeycomb could not complete the AI analysis.",
        code: "OPENAI_REQUEST_FAILED"
      });
    }

    const outputText = getOutputText(raw);
    let analysis;
    try {
      analysis = JSON.parse(outputText);
    } catch {
      console.error("Structured response parse failed");
      return res.status(502).json({
        error: "Honeycomb received an unreadable analysis.",
        code: "INVALID_MODEL_OUTPUT"
      });
    }

    return res.json({
      analysis,
      sources: extractSources(raw),
      model: raw.model || MODEL,
      responseId: raw.id || ""
    });
  } catch (error) {
    console.error("Analyze scan failed:", error?.name || "unknown_error");
    return res.status(500).json({
      error: "Honeycomb Brain is temporarily unavailable.",
      code: "SERVER_ERROR"
    });
  }
});

app.use((err, _req, res, _next) => {
  if (String(err?.message || "").includes("Origin not allowed")) {
    return res.status(403).json({ error: "Origin not allowed." });
  }
  console.error("Unhandled server error");
  return res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`Honeycomb Brain listening on port ${PORT}`);
});
