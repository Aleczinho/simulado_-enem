const { KEY, CLOSE } = require("./_lib");

// O gabarito só é entregue aos alunos depois do encerramento da prova.
module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (Date.now() < CLOSE) return res.status(403).json({ error: "Gabarito liberado após as 22h." });
  res.status(200).json({ key: KEY });
};
