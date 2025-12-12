import {
    BoxRenderable,
    getKeyHandler,
    GroupRenderable,
    InputRenderable,
    InputRenderableEvents,
    SelectRenderable,
    SelectRenderableEvents,
    TextRenderable,
    type CliRenderer,
    type ParsedKey,
    type SelectOption,
  } from "@opentui/core";
  import { execSync } from "node:child_process";
  import { createGateway } from "@ai-sdk/gateway";
  import { streamText } from "ai";
  import { chatColors, colors } from "../styles/colors";
  import { getGlobalState } from "./state";
  
  let renderer: CliRenderer | null = null;
  let header: TextRenderable | null = null;
  let headerBox: BoxRenderable | null = null;
  // let userInfo: TextRenderable | null = null;
  // let userInfoBox: BoxRenderable | null = null;
  let selectContainer: GroupRenderable | null = null;
  let selectContainerBox: BoxRenderable | null = null;
  let chatSelect: SelectRenderable | null = null;
  let chatSelectBox: BoxRenderable | null = null;
  let inputContainer: GroupRenderable | null = null;
  let inputContainerBox: BoxRenderable | null = null;
  let inputLabel: TextRenderable | null = null;
  let textInput: InputRenderable | null = null;
  let textInputBox: BoxRenderable | null = null;
  let footer: TextRenderable | null = null;
  let footerBox: BoxRenderable | null = null;
  let currentFocusIndex = 0;
  
  let onReturnToWelcome: (() => void) | null = null;
  let chatKeyHandlerBound = false;
  
  const focusableElements: Array<InputRenderable | SelectRenderable> = [];
  const focusableBoxes: Array<BoxRenderable | null> = [];
  
  let modelSelectorBox: BoxRenderable | null = null;
  let modelSelector: SelectRenderable | null = null;
  let isModelSelectorOpen = false;
  let previousFocusIndexBeforeSelector: number | null = null;
  let currentModelId: string | null = "openai/gpt-4o";
  
  type ChatRole = "user" | "assistant";
  interface ChatEntry {
    role: ChatRole;
    text: string;
    model?: string;
    name?: string;
  }
  const conversation: ChatEntry[] = [];
  const optionIndexToMessageText: string[] = [];
  
  function createLayoutElements(rendererInstance: CliRenderer): void {
    renderer = rendererInstance;
    renderer.setBackgroundColor(colors.background);
  
    const globalState = getGlobalState();
    console.log("Chat: Received global state:", globalState);
    const userName = globalState.name || "Unknown User";
    const apiKey = globalState.apiKey || "No API Key";
    console.log("Chat: Using name:", userName, "API key:", apiKey);
  
    headerBox = new BoxRenderable("header-box", {
      zIndex: 0,
      width: "auto",
      height: 3,
      backgroundColor: chatColors.headerBackground,
      borderStyle: "single",
      borderColor: chatColors.headerBorder,
      flexGrow: 0,
      flexShrink: 0,
    });
  
    header = new TextRenderable("header", {
      content: "CHAT INTERFACE",
      fg: chatColors.headerText,
      bg: colors.transparent,
      zIndex: 1,
      flexGrow: 1,
      flexShrink: 1,
    });
  
    headerBox.add(header);
  
    // userInfoBox = new BoxRenderable("user-info-box", {
    //   zIndex: 0,
    //   width: "auto",
    //   height: 4,
    //   backgroundColor: chatColors.selectContainerBackground,
    //   borderStyle: "single",
    //   borderColor: chatColors.selectContainerBorder,
    //   flexGrow: 0,
    //   flexShrink: 0,
    //   marginTop: 1,
    // });
  
    // userInfo = new TextRenderable("user-info", {
    //   content: `Welcome, ${userName}! API Key: ${apiKey.substring(0, 8)}...`,
    //   fg: chatColors.chatSelectText,
    //   bg: colors.transparent,
    //   zIndex: 1,
    //   flexGrow: 1,
    //   flexShrink: 1,
    // });
  
    // userInfoBox.add(userInfo);
  
    selectContainerBox = new BoxRenderable("select-container-box", {
      zIndex: 0,
      width: "auto",
      height: "auto",
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 10,
      backgroundColor: chatColors.selectContainerBackground,
      borderStyle: "single",
      borderColor: chatColors.selectContainerBorder,
      marginTop: 1,
    });
  
    selectContainer = new GroupRenderable("select-container", {
      zIndex: 1,
      width: "auto",
      height: "auto",
      flexDirection: "row",
      flexGrow: 1,
      flexShrink: 1,
    });
  
    selectContainerBox.add(selectContainer);
  
    chatSelectBox = new BoxRenderable("chat-select-box", {
      zIndex: 0,
      width: "auto",
      height: "auto",
      minHeight: 8,
      borderStyle: "single",
      borderColor: chatColors.selectContainerBorder,
      focusedBorderColor: chatColors.focusedBorder,
      title: "Chat Selection",
      titleAlignment: "center",
      flexGrow: 1,
      flexShrink: 1,
      backgroundColor: colors.transparent,
    });
  
    chatSelect = new SelectRenderable("chat-select", {
      zIndex: 1,
      width: "auto",
      height: "auto",
      minHeight: 6,
      backgroundColor: chatColors.chatSelectBackground,
      focusedBackgroundColor: chatColors.chatSelectFocusedBackground,
      textColor: chatColors.chatSelectText,
      focusedTextColor: chatColors.chatSelectFocusedText,
      selectedBackgroundColor: chatColors.chatSelectSelectedBackground,
      selectedTextColor: chatColors.chatSelectSelectedText,
      descriptionColor: chatColors.chatSelectDescription,
      selectedDescriptionColor: chatColors.chatSelectSelectedDescription,
      showScrollIndicator: true,
      wrapSelection: true,
      showDescription: false,
      flexGrow: 1,
      flexShrink: 1,
    });
  
    chatSelectBox.add(chatSelect);
  
    inputContainerBox = new BoxRenderable("input-container-box", {
      zIndex: 0,
      width: "auto",
      height: 7,
      flexGrow: 0,
      flexShrink: 0,
      backgroundColor: chatColors.inputContainerBackground,
      borderStyle: "single",
      borderColor: chatColors.inputContainerBorder,
      marginTop: 1,
    });
  
    inputContainer = new GroupRenderable("input-container", {
      zIndex: 1,
      width: "auto",
      height: "auto",
      flexDirection: "column",
      flexGrow: 1,
      flexShrink: 1,
    });
  
    inputContainerBox.add(inputContainer);
  
    inputLabel = new TextRenderable("input-label", {
      content: `Model: ${currentModelId} — type and press Enter`,
      fg: chatColors.inputLabelText,
      bg: chatColors.inputLabelBackground,
      zIndex: 0,
      flexGrow: 0,
      flexShrink: 0,
    });
  
    textInputBox = new BoxRenderable("text-input-box", {
      zIndex: 0,
      width: "auto",
      height: 3,
      borderStyle: "single",
      borderColor: chatColors.textInputBorder,
      focusedBorderColor: chatColors.textInputFocusedBorder,
      flexGrow: 0,
      flexShrink: 0,
      marginTop: 1,
      // backgroundColor: colors.transparent,
    });
  
    textInput = new InputRenderable("text-input", {
      zIndex: 1,
      width: "auto",
      height: 1,
      placeholder: "Type something here...",
      // backgroundColor: chatColors.textInputBackground,
      // focusedBackgroundColor: chatColors.textInputFocusedBackground,
      textColor: chatColors.textInputText,
      focusedTextColor: chatColors.textInputFocusedText,
      placeholderColor: chatColors.textInputPlaceholder,
      cursorColor: chatColors.textInputCursor,
      maxLength: 100,
      flexGrow: 1,
      flexShrink: 1,
    });
  
    textInputBox.add(textInput);
  
    footerBox = new BoxRenderable("footer-box", {
      zIndex: 0,
      width: "auto",
      height: 3,
      backgroundColor: chatColors.footerBackground,
      borderStyle: "single",
      borderColor: chatColors.footerBorder,
      flexGrow: 0,
      flexShrink: 0,
      marginTop: 1,
    });
  
    footer = new TextRenderable("footer", {
      content:
        "TAB: focus next | SHIFT+TAB: focus prev | ARROWS/JK: navigate | C: copy selection | ESC: return to welcome | Ctrl+C: quit",
      fg: chatColors.footerText,
      bg: colors.transparent,
      zIndex: 1,
      flexGrow: 1,
      flexShrink: 1,
    });
  
    footerBox.add(footer);
  
    selectContainer.add(chatSelectBox);
    inputContainer.add(inputLabel);
    inputContainer.add(textInputBox);
  
    renderer.root.add(headerBox);
    // renderer.root.add(userInfoBox);
    renderer.root.add(selectContainerBox);
    renderer.root.add(inputContainerBox);
    renderer.root.add(footerBox);
  
    focusableElements.push(chatSelect, textInput);
    focusableBoxes.push(chatSelectBox, textInputBox);
    setupEventHandlers();
    updateFocus();
    renderConversationToChatSelect();
  
    renderer.on("resize", handleResize);
  }
  
  function setupEventHandlers(): void {
    if (!chatSelect || !textInput) return;
  
    chatSelect.on(
      SelectRenderableEvents.SELECTION_CHANGED,
      (_index: number, _option: SelectOption) => {
        updateDisplay();
      }
    );
  
    chatSelect.on(
      SelectRenderableEvents.ITEM_SELECTED,
      (_index: number, _option: SelectOption) => {
        updateDisplay();
      }
    );
  
    textInput.on(InputRenderableEvents.INPUT, (_value: string) => {
      updateDisplay();
    });
  
    textInput.on(InputRenderableEvents.CHANGE, (_value: string) => {
      updateDisplay();
    });
  }
  
  function updateDisplay(): void {
    if (!inputLabel) return;
    inputLabel.content = `Model: ${
      currentModelId || "openai/gpt-4o"
    } — type and press Enter`;
  }
  
  function handleResize(_width: number, _height: number): void {
    // Root layout is automatically resized by the renderer
  }
  
  function updateFocus(): void {
    focusableElements.forEach((element) => element.blur());
    focusableBoxes.forEach((box) => {
      if (box) box.blur();
    });
  
    if (focusableElements[currentFocusIndex]) {
      focusableElements[currentFocusIndex]!.focus();
    }
    if (focusableBoxes[currentFocusIndex]) {
      focusableBoxes[currentFocusIndex]!.focus();
    }
  }
  
  function handleKeyPress(key: ParsedKey): void {
    if (key.name === "tab") {
      if (key.shift) {
        currentFocusIndex =
          (currentFocusIndex - 1 + focusableElements.length) %
          focusableElements.length;
      } else {
        currentFocusIndex = (currentFocusIndex + 1) % focusableElements.length;
      }
      updateFocus();
      return;
    } else if ((key.name === "c" || (key as any).sequence === "c") && chatSelect) {
      // Copy selected message (hovered/selected) to clipboard
      const selectedIndex = (chatSelect as any).selectedIndex as number | undefined;
      if (typeof selectedIndex === "number" && selectedIndex >= 0) {
        const text = optionIndexToMessageText[selectedIndex] || "";
        if (text) {
          try {
            if (process.platform === "darwin") {
              execSync(`printf %s ${JSON.stringify(text)} | pbcopy`);
            } else if (process.platform === "linux") {
              execSync(`printf %s ${JSON.stringify(text)} | xclip -selection clipboard -i`);
            }
          } catch {}
        }
      }
      return;
    } else if (key.name === "escape") {
      if (isModelSelectorOpen) {
        closeModelSelector();
        return;
      }
      if (onReturnToWelcome) {
        onReturnToWelcome();
      }
      return;
    } else if (
      (key as any).sequence === "/" ||
      key.name === "/" ||
      key.name === "slash"
    ) {
      // If slash is typed while text input is focused, open model selector
      const isTextInputFocused =
        focusableElements[currentFocusIndex] &&
        textInput &&
        focusableElements[currentFocusIndex] === textInput;
      if (isTextInputFocused && !isModelSelectorOpen) {
        void openModelSelector();
      }
      return;
    } else if (key.name === "return" || key.name === "enter") {
      const isTextInputFocused =
        focusableElements[currentFocusIndex] &&
        textInput &&
        focusableElements[currentFocusIndex] === textInput;
      if (isTextInputFocused && textInput && textInput.value.trim().length > 0) {
        void handleSendMessage(textInput.value.trim());
        textInput.value = "";
        updateDisplay();
      }
      return;
    }
  }
  
  export function chat(
    rendererInstance: CliRenderer,
    returnToWelcomeCallback?: () => void
  ): void {
    onReturnToWelcome = returnToWelcomeCallback || null;
    createLayoutElements(rendererInstance);
    if (!chatKeyHandlerBound) {
      getKeyHandler().on("keypress", handleKeyPress);
      chatKeyHandlerBound = true;
    }
    updateDisplay();
  }
  
  export function destroyChat(rendererInstance: CliRenderer): void {
    if (chatKeyHandlerBound) {
      try {
        getKeyHandler().off("keypress", handleKeyPress);
      } catch {}
      chatKeyHandlerBound = false;
    }
  
    try {
      try {
        rendererInstance.off("resize", handleResize as any);
      } catch {}
  
      if (modelSelectorBox) {
        rendererInstance.root.remove(modelSelectorBox.id);
        modelSelectorBox = null;
      }
      if (modelSelector) {
        modelSelector = null;
      }
      if (headerBox) {
        rendererInstance.root.remove(headerBox.id);
        headerBox = null;
      }
      if (header) {
        header = null;
      }
      // if (userInfoBox) {
      //   rendererInstance.root.remove(userInfoBox.id);
      //   userInfoBox = null;
      // }
      // if (userInfo) {
      //   userInfo = null;
      // }
      if (selectContainerBox) {
        rendererInstance.root.remove(selectContainerBox.id);
        selectContainerBox = null;
      }
      if (selectContainer) {
        selectContainer = null;
      }
      if (chatSelectBox) {
        rendererInstance.root.remove(chatSelectBox.id);
        chatSelectBox = null;
      }
      if (chatSelect) {
        chatSelect = null;
      }
      if (inputContainerBox) {
        rendererInstance.root.remove(inputContainerBox.id);
        inputContainerBox = null;
      }
      if (inputContainer) {
        inputContainer = null;
      }
      if (textInputBox) {
        rendererInstance.root.remove(textInputBox.id);
        textInputBox = null;
      }
      if (textInput) {
        textInput = null;
      }
      if (footerBox) {
        rendererInstance.root.remove(footerBox.id);
        footerBox = null;
      }
      if (footer) {
        footer = null;
      }
    } catch {}
  
    focusableElements.length = 0;
    focusableBoxes.length = 0;
  
    conversation.length = 0;
    currentFocusIndex = 0;
    currentModelId = "openai/gpt-4o";
    isModelSelectorOpen = false;
    previousFocusIndexBeforeSelector = null;
    onReturnToWelcome = null;
  }
  
  async function openModelSelector(): Promise<void> {
    if (!renderer || !textInputBox) return;
  
    const r: any = renderer as any;
    const termW = r.terminalWidth || process.stdout.columns || 80;
    const termH = r.terminalHeight || process.stdout.rows || 24;
    const selectorHeight = 12;
    const selectorWidth = Math.min(80, Math.max(40, Math.floor(termW * 0.35)));
    const aboveInputOffset = 2;
    const selectorTop = Math.max(
      1,
      termH - 7 /*inputContainerBox height*/ - selectorHeight - aboveInputOffset
    );
  
    modelSelectorBox = new BoxRenderable("model-selector-box", {
      zIndex: 1000,
      width: selectorWidth,
      height: selectorHeight,
      position: "absolute",
      left: 2,
      top: selectorTop,
      borderStyle: "single",
      borderColor: chatColors.selectContainerBorder,
      focusedBorderColor: chatColors.focusedBorder,
      title: "Select Model",
      titleAlignment: "center",
      backgroundColor: colors.popover,
    });
  
    modelSelector = new SelectRenderable("model-select", {
      zIndex: 1001,
      width: "auto",
      height: "auto",
      minHeight: selectorHeight - 2,
      options: [],
      visible: true,
      backgroundColor: chatColors.chatSelectBackground,
      focusedBackgroundColor: chatColors.chatSelectFocusedBackground,
      textColor: chatColors.chatSelectText,
      focusedTextColor: chatColors.chatSelectFocusedText,
      selectedBackgroundColor: chatColors.chatSelectSelectedBackground,
      selectedTextColor: chatColors.chatSelectSelectedText,
      descriptionColor: chatColors.chatSelectDescription,
      selectedDescriptionColor: chatColors.chatSelectSelectedDescription,
      showDescription: true,
      showScrollIndicator: true,
      wrapSelection: false,
      flexGrow: 1,
      flexShrink: 1,
    });
  
    modelSelectorBox.add(modelSelector);
    renderer.root.add(modelSelectorBox);
  
    const { apiKey } = getGlobalState();
    try {
      const gateway = createGateway({
        apiKey: apiKey || "",
        baseURL: "https://ai-gateway.vercel.sh/v1/ai",
      });
      const availableModels = await (gateway as any).getAvailableModels();
      const options: SelectOption[] = (availableModels?.models || []).map(
        (model: any) => {
          const pricingParts: string[] = [];
          if (model?.pricing?.input)
            pricingParts.push(`In: $${model.pricing.input}/tok`);
          if (model?.pricing?.output)
            pricingParts.push(`Out: $${model.pricing.output}/tok`);
          const pricing =
            pricingParts.length > 0 ? ` | ${pricingParts.join(" ")}` : "";
          const description = `${model?.description || ""}${pricing}`.trim();
          return {
            name: model?.name || model?.id || "unknown",
            description,
            value: model?.id || model?.name,
          } as SelectOption;
        }
      );
      if (modelSelector) {
        (modelSelector as any).options = options;
      }
    } catch (error) {
      if (modelSelector) {
        (modelSelector as any).options = [
          {
            name: "Failed to load models",
            description: (error as Error)?.message || "",
            value: "",
          },
        ];
      }
    }
  
    // Wire selection events
    if (modelSelector) {
      modelSelector.on(
        SelectRenderableEvents.ITEM_SELECTED,
        (index: number, option: SelectOption) => {
          currentModelId = String(option.value || "openai/gpt-4o");
          updateDisplay();
          closeModelSelector();
        }
      );
      modelSelector.on(SelectRenderableEvents.SELECTION_CHANGED, () => {});
    }
  
    previousFocusIndexBeforeSelector = currentFocusIndex;
    focusableElements.push(modelSelector!);
    focusableBoxes.push(modelSelectorBox);
    currentFocusIndex = focusableElements.length - 1;
    isModelSelectorOpen = true;
    updateFocus();
  }
  
  function closeModelSelector(): void {
    if (!renderer) return;
    if (modelSelectorBox) {
      try {
        renderer.root.remove(modelSelectorBox.id);
      } catch {}
      modelSelectorBox = null;
    }
    if (modelSelector) {
      // Remove from focusables precisely if present
      const idx = focusableElements.indexOf(modelSelector);
      if (idx >= 0) {
        focusableElements.splice(idx, 1);
        focusableBoxes.splice(idx, 1);
      }
      modelSelector = null;
    }
    isModelSelectorOpen = false;
    if (
      previousFocusIndexBeforeSelector !== null &&
      previousFocusIndexBeforeSelector >= 0
    ) {
      currentFocusIndex = Math.min(
        previousFocusIndexBeforeSelector,
        Math.max(0, focusableElements.length - 1)
      );
    }
    previousFocusIndexBeforeSelector = null;
    updateFocus();
  }
  
  function renderConversationToChatSelect(): void {
    if (!chatSelect) return;
    const { name } = getGlobalState();
    const r: any = renderer as any;
    const termW = (r && r.terminalWidth) || process.stdout.columns || 80;
    const contentWidth = Math.max(30, Math.min(120, termW - 8));
  
    const wrapToLines = (text: string, width: number): string[] => {
      const words = text.split(/\s+/);
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (candidate.length > width) {
          if (line) lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      if (line) lines.push(line);
      return lines;
    };
  
    const visualOptions: SelectOption[] = [];
    optionIndexToMessageText.length = 0;
    conversation.forEach((entry) => {
      const labelPrefix =
        entry.role === "assistant"
          ? entry.model || "model"
          : entry.name || name || "user";
      const full = `${labelPrefix}: ${entry.text}`;
      const lines = wrapToLines(full, contentWidth);
      lines.forEach((ln, i) => {
        visualOptions.push({
          name: i === 0 ? ln : `  ${ln}`,
          description: "",
          value: String(visualOptions.length),
        } as SelectOption);
        // Map each visual line index to the underlying full message text for copying
        optionIndexToMessageText.push(entry.text);
      });
    });
  
    (chatSelect as any).options = visualOptions;
    if (visualOptions.length > 0) {
      (chatSelect as any).selectedIndex = visualOptions.length - 1;
    }
  }
  
  async function handleSendMessage(userText: string): Promise<void> {
    const { apiKey, name } = getGlobalState();
    conversation.push({ role: "user", text: userText, name: name || "user" });
    renderConversationToChatSelect();
  
    const modelId = currentModelId || undefined;
    const gateway = createGateway({
      apiKey: apiKey || "",
      baseURL: "https://ai-gateway.vercel.sh/v1/ai",
    });
  
    // Start assistant entry for streaming
    const assistantIndex =
      conversation.push({ role: "assistant", text: "", model: modelId }) - 1;
    renderConversationToChatSelect();
  
    try {
      const { textStream } = streamText({
        model: modelId ? gateway(modelId) : gateway("openai/gpt-4o"),
        prompt: userText,
      } as any);
  
      for await (const delta of textStream) {
        conversation[assistantIndex] = conversation[assistantIndex] || {
          role: "assistant",
          text: "",
        };
        conversation[assistantIndex].text += delta as unknown as string;
        renderConversationToChatSelect();
      }
    } catch (err) {
      conversation[assistantIndex] = conversation[assistantIndex] || {
        role: "assistant",
        text: "",
      };
      conversation[assistantIndex].text += `\n[error] ${
        (err as Error)?.message || String(err)
      }`;
    } finally {
      renderConversationToChatSelect();
    }
  }