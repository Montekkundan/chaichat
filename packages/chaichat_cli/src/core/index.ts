import {
    createCliRenderer,
    getKeyHandler,
    GroupRenderable,
    InputRenderable,
    InputRenderableEvents,
    RenderableEvents,
    TextRenderable,
    BoxRenderable,
    type CliRenderer,
    type ParsedKey,
  } from "@opentui/core";
  import { execSync } from "node:child_process";
  import { chat, destroyChat } from "./chat";
  import { startPyramid, stopPyramid } from "./pyramid";
  import { getGlobalState, setGlobalState, resetGlobalState } from "./state";
  import { chatColors, colors } from "../styles/colors";
  import { configManager } from "../config";
  // import { debug } from "../utils/debug";
  
  let currentRenderer: CliRenderer | null = null;
  let currentScreen: "welcome" | "chat" = "welcome";
  
  let welcomeContainer: GroupRenderable | null = null;
  let nameInput: InputRenderable | null = null;
  let apiKeyInput: InputRenderable | null = null;
  let footer: TextRenderable | null = null;
  let welcomeKeyHandler: ((key: ParsedKey) => void) | null = null;
  let activeInputIndex = 0;
  const inputs: InputRenderable[] = [];
  let apiKeyShadow = "";
  
  let pyramidContainer: GroupRenderable | null = null;
  let pyramidText: TextRenderable | null = null;
  let pyramidRightText1: TextRenderable | null = null;
  let pyramidRightText2: TextRenderable | null = null;
  let rightContainer: GroupRenderable | null = null;
  let nameInputBox: BoxRenderable | null = null;
  let apiKeyInputBox: BoxRenderable | null = null;
  
  function validateName(value: string): boolean {
    return !!value && value.length >= 2;
  }
  
  function validateApiKey(value: string): boolean {
    return !!value && value.length >= 2;
  }
  
  function getActiveInput(): InputRenderable | null {
    return inputs[activeInputIndex] || null;
  }
  
  function navigateToInput(index: number): void {
    const current = getActiveInput();
    current?.blur();
    activeInputIndex = Math.max(0, Math.min(index, inputs.length - 1));
    // enforce exclusive focus
    inputs.forEach((inp, idx) => {
      if (idx === activeInputIndex) inp.focus();
      else inp.blur();
    });
  }
  
  function handleResize(width: number, height: number): void {
    if (!currentRenderer) return;
    if (currentScreen !== "welcome") return;
    const termW = width || (currentRenderer as any).terminalWidth || 80;
    const termH = height || (currentRenderer as any).terminalHeight || 24;
  
    const inputWidth = Math.max(36, Math.min(60, Math.floor(termW * 0.35)));
    const inputHeight = 3;
    const halfW = Math.floor(termW / 2);
    const leftPaneCenterX = Math.floor(halfW / 2);
    const rightPaneLeft = halfW + 2;
    const rightPaneWidth = termW - rightPaneLeft - 2;
    const stackTotalHeight = inputHeight * 2 + 5;
    const stackTop = Math.max(2, Math.floor((termH - stackTotalHeight) / 2));
  
    if (rightContainer) {
      (rightContainer as any).left = rightPaneLeft;
      (rightContainer as any).top = stackTop;
      (rightContainer as any).width = rightPaneWidth;
    }
    if (nameInputBox) {
      (nameInputBox as any).width = inputWidth;
      (nameInputBox as any).height = inputHeight;
    }
    if (apiKeyInputBox) {
      (apiKeyInputBox as any).width = inputWidth;
      (apiKeyInputBox as any).height = inputHeight;
    }
    if (footer) {
      (footer as any).top = termH - 2;
    }
  
    const pyrWidth = Math.min(48, Math.max(28, Math.floor(halfW * 0.9)));
    const pyrHeight = Math.min(24, Math.max(12, Math.floor(termH * 0.65)));
    if (pyramidContainer) {
      (pyramidContainer as any).left = Math.max(2, leftPaneCenterX - Math.floor(pyrWidth / 2));
      (pyramidContainer as any).top = Math.max(1, Math.floor(termH / 2 - pyrHeight / 2) - 1);
    }
    if (pyramidText) {
      (pyramidText as any).width = pyrWidth;
      (pyramidText as any).height = pyrHeight;
    }
    // Restart animation with new resolution
    try {
      stopPyramid(currentRenderer);
    } catch {}
    if (pyramidText) {
      startPyramid(currentRenderer, pyramidText, {
        width: pyrWidth,
        height: pyrHeight,
        speed: 0.8,
        axis: "y",
        wireframe: false,
        edges: true,
        edgeChar: "+",
        scale: 1.5,
        desiredDist: 4.6,
        xScale: 34,
        yScale: 16,
        yOffset: -3,
        faceChars: ["@", "#", "$", "*"],
        du: 0.02,
        dv: 0.02,
      });
    }
    try {
      (currentRenderer as any).needsUpdate?.();
    } catch {}
  }
  function attachWelcomeHandlers(): void {
    for (const input of inputs) {
      input.on(InputRenderableEvents.INPUT, (value: string) => {
        if (input === apiKeyInput) {
          input.value = "*".repeat(apiKeyShadow.length);
          input.textColor = validateApiKey(apiKeyShadow) ? "#FFFFFF" : "#FF5555";
        } else if (input === nameInput) {
          input.textColor = validateName(value) ? "#FFFFFF" : "#FF5555";
        }
      });
  
      input.on(InputRenderableEvents.ENTER, (value: string) => {
        const isName = input === nameInput;
        const currentVal = isName ? value : apiKeyShadow;
        const isValid = isName
          ? validateName(currentVal)
          : validateApiKey(currentVal);
        if (!isValid) {
          input.textColor = "#FF5555";
          return;
        }
        // commit only the active field; global Enter performs full validation/transition
        if (isName) {
          configManager.setName(currentVal);
          setGlobalState({ name: currentVal });
        } else {
          configManager.setVercelAiSdkKey(currentVal);
          setGlobalState({ apiKey: currentVal });
        }
      });
    }
  
    // Keep only one focused at a time if user uses mouse or programmatic focus
    for (const [idx, input] of inputs.entries()) {
      input.on(RenderableEvents.FOCUSED, () => {
        activeInputIndex = idx;
        inputs.forEach((inp, j) => {
          if (j !== idx) inp.blur();
        });
      });
    });
  
    welcomeKeyHandler = (key: ParsedKey) => {
      // Helper to read clipboard (macOS pbpaste, Linux xclip)
      const getClipboardText = (): string => {
        try {
          if (process.platform === "darwin") {
            return execSync("pbpaste", { encoding: "utf8" });
          }
          if (process.platform === "linux") {
            return execSync("xclip -o -selection clipboard", {
              encoding: "utf8",
            });
          }
        } catch {}
        return "";
      };
  
      // Allow paste via Cmd+V / Ctrl+V
      if ((key.meta && key.name === "v") || (key.ctrl && key.name === "v")) {
        const active = getActiveInput();
        if (active) {
          const pasteText = getClipboardText();
          if (pasteText) {
            if (active === apiKeyInput) {
              apiKeyShadow += pasteText;
              active.value = "*".repeat(apiKeyShadow.length);
              active.textColor = validateApiKey(apiKeyShadow)
                ? "#FFFFFF"
                : "#FF5555";
            } else if (active === nameInput) {
              active.value = (active.value || "") + pasteText;
              active.textColor = validateName(active.value)
                ? "#FFFFFF"
                : "#FF5555";
            }
          }
        }
        return;
      }
  
      // While API key input is focused, capture printable characters to shadow
      const active = getActiveInput();
      if (active && active === apiKeyInput) {
        if (key.name === "backspace") {
          apiKeyShadow = apiKeyShadow.slice(0, -1);
          active.value = "*".repeat(apiKeyShadow.length);
          active.textColor = validateApiKey(apiKeyShadow) ? "#FFFFFF" : "#FF5555";
          return;
        }
        // Ignore control keys
        const raw = (key as any).raw as string | undefined;
        if (
          raw &&
          raw.length === 1 &&
          !key.ctrl &&
          !key.meta &&
          /[\x20-\x7E]/.test(raw)
        ) {
          apiKeyShadow += raw;
          active.value = "*".repeat(apiKeyShadow.length);
          active.textColor = validateApiKey(apiKeyShadow) ? "#FFFFFF" : "#FF5555";
          return;
        }
      }
      if (key.name === "return" || key.name === "enter") {
        const nameVal = nameInput?.value || "";
        const keyVal = apiKeyShadow || "";
        const nameOk = validateName(nameVal);
        const keyOk = validateApiKey(keyVal);
        if (!nameOk && nameInput) nameInput.textColor = "#FF5555";
        else if (nameInput) nameInput.textColor = "#FFFFFF";
        if (!keyOk && apiKeyInput) apiKeyInput.textColor = "#FF5555";
        else if (apiKeyInput) apiKeyInput.textColor = "#FFFFFF";
        if (nameOk && keyOk) {
          configManager.setName(nameVal);
          configManager.setVercelAiSdkKey(keyVal);
          setGlobalState({ name: nameVal, apiKey: keyVal });
          maybeSwitchToChat();
        }
        return;
      }
      if (key.name === "tab") {
        if (key.shift) navigateToInput(activeInputIndex - 1);
        else navigateToInput(activeInputIndex + 1);
        return;
      }
      if (key.ctrl && key.name === "c") {
        const active = getActiveInput();
        if (active) {
          active.value = "";
          if (active === nameInput) setGlobalState({ name: "" });
          else {
            setGlobalState({ apiKey: "" });
            apiKeyShadow = "";
          }
        }
        return;
      }
      if (key.ctrl && key.name === "r") {
        if (nameInput) nameInput.value = "";
        if (apiKeyInput) apiKeyInput.value = "";
        setGlobalState({ name: "", apiKey: "" });
        apiKeyShadow = "";
        return;
      }
    };
    getKeyHandler().on("keypress", welcomeKeyHandler);
  }
  
  function detachWelcomeHandlers(): void {
    if (welcomeKeyHandler) {
      try {
        getKeyHandler().off("keypress", welcomeKeyHandler);
      } catch {}
      welcomeKeyHandler = null;
    }
  }
  
  function buildWelcome(): void {
    if (!currentRenderer) return;
    const r = currentRenderer;
    const termW = (r as any).terminalWidth || process.stdout.columns || 80;
    const termH = (r as any).terminalHeight || process.stdout.rows || 24;
  
    const inputWidth = Math.max(36, Math.min(60, Math.floor(termW * 0.35)));
    const inputHeight = 3;
    const halfW = Math.floor(termW / 2);
    const leftPaneCenterX = Math.floor(halfW / 2);
    const rightPaneLeft = halfW + 2;
    const rightPaneWidth = termW - rightPaneLeft - 2;
  
    const stackTotalHeight = inputHeight * 2 + 5; // header lines + spacing
    const stackTop = Math.max(2, Math.floor((termH - stackTotalHeight) / 2));
  
    welcomeContainer = new GroupRenderable("welcome-container", {
      zIndex: 10,
      visible: true,
    });
    r.root.add(welcomeContainer);
  
    rightContainer = new GroupRenderable("welcome-right-container", {
      position: "absolute",
      left: rightPaneLeft,
      top: stackTop,
      width: rightPaneWidth,
      height: "auto",
      zIndex: 100,
      flexDirection: "column",
    } as any);
    r.root.add(rightContainer);
  
    pyramidRightText1 = new TextRenderable("pyramid-right-1", {
      content: "OpenTUI AI Gateway",
      fg: "#E0E0E0",
      bg: colors.transparent,
      zIndex: 101,
    });
    pyramidRightText2 = new TextRenderable("pyramid-right-2", {
      content: "Enter your name and AI Gateway key to continue",
      fg: "#A0A0A0",
      bg: colors.transparent,
      zIndex: 101,
      marginBottom: 1,
    } as any);
    rightContainer.add(pyramidRightText1);
    rightContainer.add(pyramidRightText2);
  
    nameInputBox = new BoxRenderable("name-input-box", {
      width: inputWidth,
      height: inputHeight,
      zIndex: 101,
      borderStyle: "single",
      borderColor: chatColors.textInputBorder,
      focusedBorderColor: chatColors.textInputFocusedBorder,
      backgroundColor: colors.transparent,
    });
    nameInput = new InputRenderable("name-input", {
      width: "auto",
      height: 1,
      zIndex: 102,
      textColor: "#FFFFFF",
      placeholder: "Enter your name...",
      placeholderColor: "#666666",
      cursorColor: "#FFFF00",
      value: "",
      maxLength: 50,
    });
    nameInputBox.add(nameInput);
  
    apiKeyInputBox = new BoxRenderable("api-key-input-box", {
      width: inputWidth,
      height: inputHeight,
      zIndex: 101,
      borderStyle: "single",
      borderColor: chatColors.textInputBorder,
      focusedBorderColor: chatColors.textInputFocusedBorder,
      backgroundColor: colors.transparent,
      marginTop: 1,
    } as any);
    apiKeyInput = new InputRenderable("ai-gateway-key-input", {
      width: "auto",
      height: 1,
      zIndex: 102,
      textColor: "#FFFFFF",
      placeholder: "Enter your AI Gateway Key...",
      placeholderColor: "#666666",
      cursorColor: "#FFFF00",
      value: "",
      maxLength: 100,
    });
    apiKeyInputBox.add(apiKeyInput);
  
    inputs.length = 0;
    inputs.push(nameInput, apiKeyInput);
  
    rightContainer.add(nameInputBox);
    rightContainer.add(apiKeyInputBox);
  
    footer = new TextRenderable("welcome-footer", {
      content: `Tab: Navigate | Shift+Tab: Navigate Back | Enter: Save | Ctrl+C: Clear | Ctrl+R: Reset | Config: ${configManager.getConfigPath()}`,
      fg: chatColors.footerText,
      bg: colors.transparent,
      zIndex: 1,
      position: "absolute",
      left: 0,
      top: termH - 2,
      width: "auto",
      height: 1,
    });
    r.root.add(footer);
  
    // Pyramid container
    const pyrWidth = Math.min(48, Math.max(28, Math.floor(halfW * 0.9)));
    const pyrHeight = Math.min(24, Math.max(12, Math.floor(termH * 0.65)));
    pyramidContainer = new GroupRenderable("pyramid-container", {
      position: "absolute",
      left: Math.max(2, leftPaneCenterX - Math.floor(pyrWidth / 2)),
      top: Math.max(1, Math.floor(termH / 2 - pyrHeight / 2) - 1),
      width: "auto",
      height: "auto",
      zIndex: 5,
      flexDirection: "row",
    });
    r.root.add(pyramidContainer);
  
    pyramidText = new TextRenderable("pyramid-text", {
      content: "",
      fg: chatColors.footerText,
      bg: colors.transparent,
      zIndex: 6,
      width: pyrWidth,
      height: pyrHeight,
      wrap: false,
    } as any);
  
    pyramidContainer.add(pyramidText);
  
    startPyramid(r, pyramidText, {
      width: pyrWidth,
      height: pyrHeight,
      speed: 0.8,
      axis: "y",
      wireframe: false,
      edges: true,
      edgeChar: "+",
      scale: 1.5,
      desiredDist: 4.6,
      xScale: 34,
      yScale: 16,
      yOffset: -3,
      faceChars: ["@", "#", "$", "*"],
      du: 0.02,
      dv: 0.02,
    });
  
    attachWelcomeHandlers();
    nameInput.focus();
    // resize listener
    try {
      r.on("resize", handleResize as any);
    } catch {}
  }
  
  function destroyWelcome(): void {
    detachWelcomeHandlers();
    if (!currentRenderer) return;
    const r = currentRenderer;
    stopPyramid(r);
    try {
      r.off("resize", handleResize as any);
    } catch {}
    if (nameInput) {
      r.root.remove(nameInput.id);
      nameInput = null;
    }
    if (apiKeyInput) {
      r.root.remove(apiKeyInput.id);
      apiKeyInput = null;
    }
    if (footer) {
      r.root.remove(footer.id);
      footer = null;
    }
    if (rightContainer) {
      try {
        r.root.remove(rightContainer.id);
      } catch {}
      rightContainer = null;
    }
    if (pyramidContainer) {
      try {
        if (pyramidText) pyramidText = null;
        if (pyramidRightText1) pyramidRightText1 = null;
        if (pyramidRightText2) pyramidRightText2 = null;
        r.root.remove(pyramidContainer.id);
      } catch {}
      pyramidContainer = null;
    }
    if (welcomeContainer) {
      r.root.remove(welcomeContainer.id);
      welcomeContainer = null;
    }
    inputs.length = 0;
  }
  
  function clearRoot(): void {
    if (!currentRenderer) return;
    const root = (currentRenderer as any).root;
    if (root && Array.isArray(root.children)) {
      root.children.slice().forEach((child: any) => {
        if (child && typeof child === "object" && "id" in child) {
          root.remove(child.id);
        }
      });
    }
  }
  
  function maybeSwitchToChat(): void {
    const state = getGlobalState();
    if (
      validateName(state.name) &&
      validateApiKey(state.apiKey) &&
      currentScreen === "welcome"
    ) {
      switchToChat();
    }
  }
  
  function switchToChat(): void {
    if (!currentRenderer) return;
    console.log("Both values received, switching to chat...");
    currentScreen = "chat";
    destroyWelcome();
    clearRoot();
    try {
      getKeyHandler().removeAllListeners?.("keypress");
    } catch {}
    chat(currentRenderer, switchToWelcome);
    try {
      (currentRenderer as any).needsUpdate?.();
    } catch {}
  }
  
  function switchToWelcome(): void {
    if (!currentRenderer) return;
    console.log("Switching back to welcome...");
    currentScreen = "welcome";
    try {
      destroyChat(currentRenderer);
    } catch {}
    clearRoot();
    try {
      getKeyHandler().removeAllListeners?.("keypress");
    } catch {}
    // Fully clear state and persisted config so user must re-enter
    resetGlobalState();
    try {
      configManager.setName("");
      configManager.setVercelAiSdkKey("");
    } catch {}
    // Reset masked api key buffer
    apiKeyShadow = "";
    buildWelcome();
    try {
      (currentRenderer as any).needsUpdate?.();
    } catch {}
  }
  
  async function run(): Promise<void> {
    const r = await createCliRenderer({ exitOnCtrlC: true });
    currentRenderer = r;
    r.start();
    // debug(r);
    currentScreen = "welcome";
    buildWelcome();
  }
  
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });