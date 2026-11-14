const { redis } = require("./_lib");

// Diagnóstico simples (não expõe segredos): abra /api/health no navegador.
module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const out = {
    senhaProfessorConfigurada: !!process.env.PROF_PASSWORD,
    bancoUrlConfigurada: !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL),
    bancoTokenConfigurado: !!(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN),
    bancoRespondendo: false,
  };
  try { await redis.set("health", "ok", { ex: 60 }); out.bancoRespondendo = (await redis.get("health")) === "ok"; }
  catch (e) { out.erro = String(e && e.message || e).slice(0, 200); }
  res.status(200).json(out);
};
