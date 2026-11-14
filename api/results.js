const { KEY, TEMA_Q, TEMAS, redis, grade, checkProf } = require("./_lib");

// Área do professor: exige a senha em todas as chamadas.
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!(await checkProf(req, res))) return;

  if (req.method === "DELETE") {
    const id = String((req.query && req.query.id) || "");
    if (!/^[a-f0-9]{20}$/.test(id)) return res.status(400).json({ error: "id inválido" });
    await redis.hdel("subs", id);
    return res.status(200).json({ ok: true });
  }

  let all = {}, dbError = false;
  try { all = (await redis.hgetall("subs")) || {}; } catch (e) { dbError = true; all = {}; }
  const subs = Object.keys(all).map((id) => {
    let r = all[id];
    if (typeof r === "string") r = JSON.parse(r);
    const g = grade(r.ans);
    return { id, nome: r.nome, turma: r.turma, ans: r.ans, at: r.at, started: r.started, auto: r.auto,
             total: g.total, mat: g.mat, fis: g.fis, tema: g.tema };
  });
  res.status(200).json({ subs, dbError, meta: { key: KEY, temaQ: TEMA_Q, temas: TEMAS } });
};
