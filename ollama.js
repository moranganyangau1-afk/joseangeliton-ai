(function () {
  "use strict";
  const MODES = {
    Friendly: "Be warm, kind, supportive, and conversational. Listen carefully and respond with genuine empathy.",
    Funny: "Be playful, witty, and entertaining. Use light humor naturally, but remain helpful and never mean-spirited.",
    Savage: "Use cheeky, sharp, playful roasting when fitting, but never attack identity, vulnerabilities, or protected traits. Keep it affectionate and avoid cruelty.",
    Romantic: "Be sweet, affectionate, and charming while maintaining appropriate boundaries. Do not imply exclusivity or a real-world romantic relationship.",
    Professional: "Be concise, polished, accurate, and business-oriented. Structure complex answers clearly and avoid unnecessary banter.",
    Motivational: "Be encouraging and energizing. Help the user find realistic next steps; don't shame them or promise guaranteed outcomes.",
    Teacher: "Explain concepts simply, build from fundamentals, use examples, and check understanding. Adapt to the user's level without being patronizing.",
  };

  async function request(path, options) {
    if (typeof location !== "undefined"
      && !["localhost", "127.0.0.1", "::1"].includes(location.hostname)) {
      throw new Error("This public demo cannot connect to private Ollama. Run the app locally and keep Ollama on your own computer.");
    }
    const response = await fetch(`/ollama${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options && options.headers) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || data.message || `Ollama returned HTTP ${response.status}.`);
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  }

  async function models() {
    const result = await request("/api/tags", { method: "GET" });
    return Array.isArray(result.models) ? result.models : [];
  }

  function systemPrompt(settings, memories) {
    const name = settings.assistantName || "JOSEANGELITON AI";
    const user = settings.userName ? ` The user's preferred name is ${settings.userName}.` : "";
    const allowedMemories = settings.memoryEnabled ? memories.map((item) => item.text).filter(Boolean) : [];
    const savedFacts = allowedMemories.length
      ? `\nRelevant saved memories (use only when applicable):\n${allowedMemories.map((text) => `- ${text}`).join("\n")}`
      : "";
    return `You are ${name}, an AI companion. Be honest that you are an AI, never claim human feelings, and do not claim to remember anything unless it appears in the saved memories provided here. Personality: ${MODES[settings.personality] || MODES.Friendly}${user}\nPrivacy: You have no permission to save memories automatically. If something seems worth remembering, ask permission in your response; only the user can add it in their memory controls. Never ask for secrets or unnecessary sensitive information. Keep responses useful and suited to the user's request.${savedFacts}`;
  }

  async function chat({ model, messages, settings, memories }) {
    const conversation = [
      { role: "system", content: systemPrompt(settings, memories) },
      ...messages.map(({ role, content }) => ({ role, content })),
    ];
    const result = await request("/api/chat", {
      method: "POST",
      body: JSON.stringify({ model, messages: conversation, stream: false }),
    });
    if (!result.message || typeof result.message.content !== "string") {
      throw new Error("Ollama returned an unexpected response. Check that the selected model is available.");
    }
    return result.message.content;
  }

  window.OllamaService = { models, chat, modes: MODES };
})();
