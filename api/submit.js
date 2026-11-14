const { OPEN, CLOSE, GRACE, redis, grade, clean, idOf } = require("./_lib");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  const b = req.body || {};
  const nome = clean(b.nome).slice(0, 80);
  const turma = clean(b.turma).slice(0, 30);
  const ans = String(b.ans || "");
  if (nome.length < 5 || nome.indexOf(" ") < 0) return res.status(400).json({ error: "Nome inválido." });
  if (!turma) return res.status(400).json({ error: "Turma inválida." });
  if (!/^[-A-E]{60}$/.test(ans)) return res.status(400).json({ error: "Respostas inválidas." });

  const now = Date.now();
  if (now < OPEN) return res.status(403).json({ error: "A prova ainda não abriu." });
  if (now > CLOSE + GRACE) return res.status(403).json({ error: "A prova foi encerrada às 22h." });

  const id = idOf(nome, turma);
  const rec = { nome, turma, ans, at: now, started: Number(b.started) || null, auto: !!b.auto };
  try {
    const created = await redis.hsetnx("subs", id, JSON.stringify(rec));
    if (!created) {
      // Já existe envio deste aluno: vale o primeiro.
      let old = await redis.hget("subs", id);
      if (typeof old === "string") old = JSON.parse(old);
      const g = grade(old.ans);
      return res.status(200).json({ at: old.at, dup: true, res: { total: g.total, mat: g.mat, fis: g.fis, tema: g.tema } });
    }
  } catch (e) {
    console.error("submit/redis:", e && e.message);
    return res.status(500).json({ error: "Falha ao salvar. Tente novamente em instantes." });
  }
  const g = grade(ans);
  res.status(200).json({ at: now, res: { total: g.total, mat: g.mat, fis: g.fis, tema: g.tema } });
};
