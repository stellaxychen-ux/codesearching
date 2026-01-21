// api/add-claim.js  (CommonJS - safest)
module.exports = async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) return res.status(500).json({ error: "Missing GITHUB_TOKEN env var" });

    const { owner_repo, path, claim } = req.body || {};
    if (!owner_repo || !path || !claim) return res.status(400).json({ error: "Missing owner_repo/path/claim" });

    const [owner, repo] = owner_repo.split("/");
    if (!owner || !repo) return res.status(400).json({ error: "owner_repo must look like owner/repo" });

    const safePath = encodeURIComponent(path).replace(/%2F/g, "/");
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${safePath}`;

    // GET existing file (sha + content)
    const getResp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        Accept: "application/vnd.github+json",
      },
    });

    let sha = null;
    let obj = {};
    if (getResp.status === 404) {
      sha = null;
      obj = {};
    } else if (!getResp.ok) {
      const t = await getResp.text();
      return res.status(getResp.status).json({ error: `GitHub GET failed: ${t}` });
    } else {
      const data = await getResp.json();
      sha = data.sha;
      const content = Buffer.from(data.content || "", "base64").toString("utf-8");
      obj = JSON.parse(content || "{}");
    }

    // Normalize claim
    const patient = String(claim.patient || "").trim();
    const date = String(claim.date || "").trim();
    const code = String(claim.code || "").trim().padStart(3, "0");
    const tooth =
      claim.tooth && Array.isArray(claim.tooth) && claim.tooth.length
        ? claim.tooth.map(String)
        : null;
    const fund = claim.fund ? String(claim.fund) : null;
    const notes = claim.notes ? String(claim.notes) : "";

    if (!patient || !date || !code) return res.status(400).json({ error: "claim.patient/date/code required" });

    const entry = { date, code, tooth, fund, notes, enteredAt: new Date().toISOString() };

    if (!obj[patient]) obj[patient] = [];
    obj[patient].push(entry);
    obj[patient].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const newContent = Buffer.from(JSON.stringify(obj, null, 2), "utf-8").toString("base64");

    // PUT back
    const body = {
      message: `Add claim: ${patient} #${code} ${date}`,
      content: newContent,
      committer: { name: "ClinicFlow Bot", email: "clinicflow-bot@users.noreply.github.com" },
    };
    if (sha) body.sha = sha;

    const putResp = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify(body),
    });

    if (!putResp.ok) {
      const t = await putResp.text();
      return res.status(putResp.status).json({ error: `GitHub PUT failed: ${t}` });
    }

    const putData = await putResp.json();
    return res.status(200).json({
      ok: true,
      commit_sha: putData.commit && putData.commit.sha,
      commit_url: putData.commit && putData.commit.html_url,
      content_path: putData.content && putData.content.path,
    });
  } catch (err) {
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
