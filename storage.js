(function () {
  "use strict";
  const KEY = "joseangeliton-ai-v1";

  function initialState() {
    const isPublicSite = typeof location !== "undefined"
      && !["localhost", "127.0.0.1", "::1"].includes(location.hostname);
    return {
      chats: [],
      activeChatId: null,
      memories: [],
      settings: {
        model: "llama3.2",
        assistantName: "JOSEANGELITON AI",
        userName: "",
        personality: "Friendly",
        theme: "dark",
        accent: "#8188ff",
        fontSize: "medium",
        memoryEnabled: true,
        speakReplies: false,
        demoMode: isPublicSite,
      },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return initialState();
      const saved = JSON.parse(raw);
      const base = initialState();
      const validChat = (chat) => chat && typeof chat.id === "string" && Array.isArray(chat.messages);
      const validMemory = (memory) => memory && typeof memory.text === "string";
      const validModes = ["Friendly", "Funny", "Savage", "Romantic", "Professional", "Motivational", "Teacher"];
      const validAccents = ["#8188ff", "#40c8e8", "#d27bff", "#ff7fa8", "#6bd5a5", "#ffa766"];
      const settings = { ...base.settings, ...(saved.settings || {}) };
      const isPublicSite = typeof location !== "undefined"
        && !["localhost", "127.0.0.1", "::1"].includes(location.hostname);
      if (isPublicSite) settings.demoMode = true;
      settings.model = typeof settings.model === "string" && settings.model.trim() ? settings.model.trim().slice(0, 100) : base.settings.model;
      settings.assistantName = typeof settings.assistantName === "string" ? settings.assistantName.trim().slice(0, 50) || base.settings.assistantName : base.settings.assistantName;
      settings.userName = typeof settings.userName === "string" ? settings.userName.trim().slice(0, 50) : "";
      settings.personality = validModes.includes(settings.personality) ? settings.personality : base.settings.personality;
      settings.theme = settings.theme === "light" ? "light" : "dark";
      settings.accent = validAccents.includes(settings.accent) ? settings.accent : base.settings.accent;
      settings.fontSize = ["small", "medium", "large"].includes(settings.fontSize) ? settings.fontSize : base.settings.fontSize;
      ["memoryEnabled", "speakReplies", "demoMode"].forEach((key) => {
        settings[key] = typeof settings[key] === "boolean" ? settings[key] : base.settings[key];
      });
      return {
        ...base,
        ...saved,
        chats: Array.isArray(saved.chats) ? saved.chats.filter(validChat).map((chat) => ({
          id: chat.id.slice(0, 100),
          title: typeof chat.title === "string" ? chat.title.slice(0, 80) : "New conversation",
          createdAt: Number.isFinite(chat.createdAt) ? chat.createdAt : Date.now(),
          updatedAt: Number.isFinite(chat.updatedAt) ? chat.updatedAt : Date.now(),
          messages: chat.messages.filter((message) => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string")
            .map((message) => ({
              id: typeof message.id === "string" ? message.id.slice(0, 100) : "",
              role: message.role,
              content: message.content.slice(0, 12000),
              createdAt: Number.isFinite(message.createdAt) ? message.createdAt : Date.now(),
              ...(message.demo === true ? { demo: true } : {}),
              ...(message.error === true ? { error: true } : {}),
            })),
        })) : [],
        memories: Array.isArray(saved.memories) ? saved.memories.filter(validMemory).map((memory) => ({
          id: typeof memory.id === "string" ? memory.id.slice(0, 100) : "",
          text: memory.text.slice(0, 500),
          createdAt: Number.isFinite(memory.createdAt) ? memory.createdAt : Date.now(),
        })) : [],
        settings,
      };
    } catch (error) {
      console.error("Could not load saved app data:", error);
      return initialState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.error("Could not save app data:", error);
      return false;
    }
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  window.AppStorage = { load, save, clear };
})();
