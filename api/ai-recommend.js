// api/ai-recommend.js
// Vercel Serverless Function (CommonJS)
// Requires env: OPENAI_API_KEY

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });

    const {
      patient,
      fund,
      asOf,
      tooth,
      history,      // array of claim records (recent)
      candidates,   // array of candidate code objects (computed on client)
      context       // optional extra notes
    } = req.body || {};

    if (!patient || !fund || !asOf || !Array.isArray(candidates)) {
      return res.status(400).json({ error: "Missing patient / fund / asOf / candidates" });
    }

    // Keep payload bounded
    const safeHistory = Array.isArray(history) ? history.slice(0, 60) : [];
    const safeCandidates = candidates.slice(0, 30);

    const system = [
      "You are a dental claim assistant for Australian item codes.",
      "You must base recommendations ONLY on the provided patient history, fund rules summary, ADA warnings/notes, and computed eligibility fields in the input.",
      "Do NOT invent fund policy details not present in the input. If uncertain, say 'needs manual confirmation' and explain what to check.",
      "Output must be concise, practical, clinic-facing."
    ].join(" ");

    const user = {
      patient,
      fund,
      asOf,
      tooth: tooth || null,
      history: safeHistory,
      candidates: safeCandidates,
      context: context || ""
    };

    // Call OpenAI Responses API (text output)
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: system },
          {
            role: "user",
            content:
`Given this JSON input, produce:

1) Top recommendations (up to 5 codes): each with:
   - code
   - eligible now? (yes/no)
   - if no, next eligible date (if provided)
   - reason (fund frequency / last claim / per-tooth / ADA conflicts)
2) Red flags / conflicts: list any ADA warnings/conflicts provided in candidates (e.g., "251 cannot be with 114").
3) Questions to confirm (only if needed): e.g., plan-level limitations, tooth-specific confirmation.

Formatting:
- Use clear headings.
- Use bullet points.
- Keep it clinic-friendly.
- If multiple funds rules exist, rely on 'fundRule' fields from candidates.`
          },
          { role: "user", content: JSON.stringify(user) }
        ]
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return res.status(resp.status).json({ error: txt });
    }

    const data = await resp.json();
    // Responses API returns output array; safest: extract plain text
    const text =
      data.output_text ||
      (Array.isArray(data.output)
        ? data.output.map(o => (o.content || []).map(c => c.text || "").join("")).join("\n")
        : "");

    return res.status(200).json({ ok: true, text });

  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
};
