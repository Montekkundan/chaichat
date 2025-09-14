export const colors = {
    // Base colors
    background: "#000000",
    foreground: "#ffffff",
  
    // Card and container colors
    card: "#090909",
    cardForeground: "#ffffff",
    popover: "#121212",
    popoverForeground: "#ffffff",
  
    // Primary and secondary colors
    primary: "#ffffff",
    primaryForeground: "#000000",
    secondary: "#222222",
    secondaryForeground: "#ffffff",
  
    // Muted and accent colors
    muted: "#1d1d1d",
    mutedForeground: "#a4a4a4",
    accent: "#333333",
    accentForeground: "#ffffff",
  
    // Border and input colors
    border: "#242424",
    input: "#333333",
    ring: "#a4a4a4",
  
    // Sidebar colors
    sidebar: "#121212",
    sidebarForeground: "#ffffff",
    sidebarPrimary: "#ffffff",
    sidebarPrimaryForeground: "#000000",
    sidebarAccent: "#333333",
    sidebarAccentForeground: "#ffffff",
    sidebarBorder: "#333333",
    sidebarRing: "#a4a4a4",
  
    // Chart colors
    chart1: "#ffae04",
    chart2: "#2671f4",
    chart3: "#747474",
    chart4: "#525252",
    chart5: "#e4e4e4",
  
    // Semantic colors
    destructive: "#ff5b5b",
    destructiveForeground: "#000000",
  
    transparent: "transparent",
  } as const;
  
  // Semantic color mappings for the chat interface
  export const chatColors = {
    // Header
    headerBackground: colors.primary,
    headerBorder: colors.ring,
    headerText: colors.primaryForeground,
  
    // Select container
    selectContainerBackground: colors.card,
    selectContainerBorder: colors.border,
  
    // Chat select
    chatSelectBackground: colors.card,
    chatSelectFocusedBackground: colors.accent,
    chatSelectText: colors.cardForeground,
    chatSelectFocusedText: colors.accentForeground,
    chatSelectSelectedBackground: colors.primary,
    chatSelectSelectedText: colors.primaryForeground,
    chatSelectDescription: colors.mutedForeground,
    chatSelectSelectedDescription: colors.mutedForeground,
  
    // Input container
    inputContainerBackground: colors.popover,
    inputContainerBorder: colors.border,
  
    // Input label
    inputLabelText: colors.popoverForeground,
    inputLabelBackground: colors.popover,
  
    // Text input
    textInputBackground: colors.input,
    textInputFocusedBackground: colors.accent,
    textInputText: colors.foreground,
    textInputFocusedText: colors.accentForeground,
    textInputPlaceholder: colors.mutedForeground,
    textInputCursor: colors.foreground,
    textInputBorder: colors.border,
    textInputFocusedBorder: colors.ring,
  
    // Footer
    footerBackground: colors.secondary,
    footerBorder: colors.border,
    footerText: colors.secondaryForeground,
  
    // Focus states
    focusedBorder: colors.ring,
  } as const;
  
  export type Colors = typeof colors;
  export type ChatColors = typeof chatColors;