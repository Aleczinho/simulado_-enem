const crypto = require("crypto");
const { Redis } = require("@upstash/redis");

const KEY = "CBDBDBDAAEDAAEDBDCEEADBEBEADECCBAEABCCDACBECCABEAACEBCCDBDED";
const TEMA_Q = ["rpp","rpp","fin","rpp","rpp","rpp","rpp","rpp","fin","rpp","rpp","rpp","fin","rpp","rpp","est","est","est","est","est","esp","esp","esp","esp","esp","fun","fun","fin","fun","fun","pla","pla","pla","pla","pro","pro","pro","pro","pg","pg","pg","tri","tri","ana","ana","ele","ele","ele","ter","ter","ter","ond","ond","cin","cin","din","din","hid","opt","mag"];
const TEMAS = {rpp:"Razão, proporção e porcentagem",fin:"Matemática financeira",est:"Estatística",esp:"Geometria espacial",fun:"Funções",pla:"Geometria plana",pro:"Probabilidade e análise combinatória",pg:"Progressões aritméticas e geométricas",tri:"Trigonometria",ana:"Geometria analítica",ele:"Eletrodinâmica",ter:"Termologia",ond:"Ondulatória",cin:"Cinemática",din:"Dinâmica e energia",hid:"Hidrostática",opt:"Óptica",mag:"Eletromagnetismo"};

const OPEN = Date.UTC(2026, 10, 14, 15, 0, 0);  // 14/11/2026 12:00 Brasília
const CLOSE = Date.UTC(2026, 10, 15, 1, 0, 0);  // 14/11/2026 22:00 Brasília
const GRACE = 10 * 60 * 1000;                   // tolerância para o envio automático das 22h

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

function grade(ans) {
  const r = { total: 0, mat: 0, fis: 0, tema: {}, per: [] };
  for (const k in TEMAS) r.tema[k] = [0, 0];
  for (let i = 0; i < 60; i++) {
    const ok = ans.charAt(i) === KEY.charAt(i);
    r.per.push(ok);
    r.tema[TEMA_Q[i]][1]++;
    if (ok) {
      r.total++;
      r.tema[TEMA_Q[i]][0]++;
      if (i < 45) r.mat++; else r.fis++;
    }
  }
  return r;
}

function norm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function clean(s) {
  return String(s == null ? "" : s).replace(/[\r\n\t|]+/g, " ").replace(/\s+/g, " ").trim();
}
function idOf(nome, turma) {
  return crypto.createHash("sha1").update(norm(nome) + "|" + norm(turma)).digest("hex").slice(0, 20);
}

function safeEq(a, b) {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

// Verifica a senha do professor, com limite de tentativas por IP.
async function checkProf(req, res) {
  const pass = process.env.PROF_PASSWORD;
  if (!pass) { res.status(500).json({ error: "PROF_PASSWORD não configurada no servidor." }); return false; }
  const ip = String(req.headers["x-forwarded-for"] || "ip").split(",")[0].trim();
  const fk = "fail:" + ip;
  let fails;
  try {
    fails = Number(await redis.get(fk)) || 0;
  } catch (e) {
    console.error("prof/rate-limit-read:", e && e.message);
    res.status(503).json({ error: "Autenticação temporariamente indisponível. Tente novamente." });
    return false;
  }
  if (fails >= 10) { res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos." }); return false; }
  const given = req.headers["x-prof-password"] || "";
  if (!safeEq(given, pass)) {
    try {
      await redis.incr(fk);
      await redis.expire(fk, 600);
    } catch (e) {
      console.error("prof/rate-limit-write:", e && e.message);
      try { await redis.del(fk); } catch (cleanupError) {
        console.error("prof/rate-limit-cleanup:", cleanupError && cleanupError.message);
      }
      res.status(503).json({ error: "Não foi possível registrar a tentativa. Tente novamente." });
      return false;
    }
    res.status(401).json({ error: "Senha incorreta." });
    return false;
  }
  return true;
}

module.exports = { KEY, TEMA_Q, TEMAS, OPEN, CLOSE, GRACE, redis, grade, clean, idOf, checkProf };
