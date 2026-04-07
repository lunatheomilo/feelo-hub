export default async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: "steam-recent route is alive",
  });
}