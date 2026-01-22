// api/add-claim.js
// Vercel Serverless Function (CommonJS)

module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return res.status(500).json({ error: "Missing GITHUB_TOKEN env var" });
    }

    const { owner_repo, path, claim } = req.body || {};
    if (!owner_repo || !path || !claim) {
      return res.status(400).json({ error: "Missing owner_repo / path / claim" });
    }

    const [owner, repo] = owner_repo.split("/");
    if (!owner || !repo) {
      return res.status(400).json({ error: "owner_repo must be owner/repo" });
    }

    const safePath = encodeURIComponent(path).replace(/%2F/g, "/");
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${safePath}`;

    // 1️⃣ Read existing file
    const getResp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    let sha = null;
    let data = {};

    if (getResp.status === 404) {
      data = {};
    } else if (!getResp.ok) {
      const txt = await getResp.text();
      return res.status(getResp.status).json({ error: txt });
    } else {
      const json = await getResp.json();
      sha = json.sha;
      const content = Buffer.from(json.content, "base64").toString("utf-8");
      data = JSON.parse(content || "{}");
    }

    // 2️⃣ Normalize claim
    const patient = String(claim.patient || "").trim();
    const date = String(claim.date || "").trim();
    const code = String(claim.code || "").padStart(3, "0");
    const tooth =
      Array.isArray(claim.tooth) && claim.tooth.length
        ? claim.tooth.map(String)
        : null;
    const fund = claim.fund ? String(claim.fund) : null;
    const notes = claim.notes ? String(claim.notes) : "";

    if (!patient || !date || !code) {
      return res.status(400).json({ error: "patient / date / code required" });
    }

    const entry = {
      date,
      code,
      tooth,
      fund,
      notes,
      enteredAt: new Date().toISOString()
    };

    if (!data[patient]) data[patient] = [];
    data[patient].push(entry);

    // sort by date
    data[patient].sort((a, b) => a.date.localeCompare(b.date));

    // 3️⃣ Write back to GitHub
    const newContent = Buffer.from(
      JSON.stringify(data, null, 2),
      "utf-8"
    ).toString("base64");

    const body = {
      message: `Add claim: ${patient} #${code} ${date}`,
      content: newContent,
      committer: {
        name: "ClinicFlow Bot",
        email: "clinicflow-bot@users.noreply.github.com"
      }
    };
    if (sha) body.sha = sha;

    const putResp = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify(body)
    });

    if (!putResp.ok) {
      const txt = await putResp.text();
      return res.status(putResp.status).json({ error: txt });
    }

    const out = await putResp.json();
    return res.status(200).json({
      ok: true,
      commit_sha: out.commit?.sha,
      commit_url: out.commit?.html_url
    });

  } catch (err) {
    return res.status(500).json({
      error: err?.message || String(err)
    });
  }
};

