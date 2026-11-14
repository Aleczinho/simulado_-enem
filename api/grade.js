const { redis, grade, idOf, checkProf } = require("./_lib");

function sig(s) {
  let h = 0x811c9dc5;
  const x = s + "|enem3a";
  for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

// Corrige comprovantes colados pelo professor. Não depende do banco de dados;
// se o banco estiver disponível, também guarda os envios (best effort).
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  if (!(await checkProf(req, res))) return;
  const text = String((req.body && req.body.text) || "").slice(0, 2000000);
  const re = /S([ET])1\|([^|\r\n]{1,80})\|([^|\r\n]{0,40})\|([-A-E]{60})\|(\d{9,11})\|([a-z0-9]{1,8})/g;
  let m, ignored = 0;
  const byId = {};
  while ((m = re.exec(text))) {
    if (m[1] === "T") { ignored++; continue; }
    const nome = m[2].trim(), turma = m[3].trim(), ans = m[4], at = Number(m[5]) * 1000;
    const base = "S" + m[1] + "1|" + m[2] + "|" + m[3] + "|" + ans + "|" + m[5];
    const id = idOf(nome, turma);
    if (byId[id] && byId[id].at <= at) { ignored++; continue; }
    const g = grade(ans);
    byId[id] = { id, nome, turma, ans, at, started: null, total: g.total, mat: g.mat, fis: g.fis, tema: g.tema, bad: sig(base) !== m[6] };
  }
  const subs = Object.keys(byId).map((k) => byId[k]);
  for (const s of subs) {
    if (s.bad) continue;
    try { await redis.hsetnx("subs", s.id, JSON.stringify({ nome: s.nome, turma: s.turma, ans: s.ans, at: s.at, started: null, auto: false, via: "comprovante" })); } catch (e) { break; }
  }
  res.status(200).json({ subs, ignored });
};
