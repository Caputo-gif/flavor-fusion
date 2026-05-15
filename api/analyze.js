// api/analyze.js — análise de imagem com preços regionais
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { image, mediaType, systemPrompt, latitude, longitude, city } = req.body;

  if (!image || !mediaType || !systemPrompt) {
    return res.status(400).json({ error: "Campos obrigatórios ausentes" });
  }
  if (image.length > 5_500_000) {
    return res.status(400).json({ error: "Imagem muito grande." });
  }

  const locationCtx = city
    ? `Usuário em: ${city} (lat ${parseFloat(latitude).toFixed(2)}, lon ${parseFloat(longitude).toFixed(2)}). Inclua campo "preco" com preços médios locais em reais (por kg ou unidade) referenciando esta região. Para Ubatuba-SP use preços do litoral norte paulista.`
    : `Localização indisponível. Use preços médios do Brasil no campo "preco".`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1800,
        system: systemPrompt + "\n\n" + locationCtx,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            { type: "text", text: "Identifique este alimento e responda APENAS com o JSON solicitado, incluindo o campo preco." },
          ],
        }],
      }),
    });

    if (!response.ok) {
      console.error("Anthropic error:", await response.text());
      return res.status(502).json({ error: "Erro ao conectar com a IA." });
    }

    const data = await response.json();
    let text = (data.content || []).map(c => c.text || "").join("").trim();
    text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
}
