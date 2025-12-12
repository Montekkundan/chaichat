export function ThemeScript() {
	return (
		<script
			// biome-ignore lint/security/noDangerouslySetInnerHtml: This is a controlled script injection for theme initialization
			dangerouslySetInnerHTML={{
				__html: `
          const DEFAULT_FONT_WEIGHTS = ["400"];

          function extractFontFamily(fontFamilyValue) {
            if (!fontFamilyValue) return null;
            const firstFont = fontFamilyValue.split(",")[0].trim();
            const cleanFont = firstFont.replace(/['"]/g, "");
            const systemFonts = [
              "ui-sans-serif", "ui-serif", "ui-monospace", "system-ui",
              "sans-serif", "serif", "monospace", "cursive", "fantasy"
            ];
            if (systemFonts.includes(cleanFont.toLowerCase())) {
              return null;
            }
            return cleanFont;
          }

          function buildFontCssUrl(family, weights) {
            weights = weights || DEFAULT_FONT_WEIGHTS;
            const encodedFamily = encodeURIComponent(family);
            const weightsParam = weights.join(";"); 
            return \`https://fonts.googleapis.com/css2?family=\${encodedFamily}:wght@\${weightsParam}&display=swap\`;
          }

          function loadGoogleFont(family, weights) {
            weights = weights || DEFAULT_FONT_WEIGHTS;
            const href = buildFontCssUrl(family, weights);
            const existing = document.querySelector(\`link[href="\${href}"]\`);
            if (existing) return;

            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            document.head.appendChild(link);
          }

          (function() {
            const storageKey = "chai-tweakcn-theme";
            const root = document.documentElement;

            let themeState = null;
            try {
              const persistedStateJSON = localStorage.getItem(storageKey);
              if (persistedStateJSON) {
                themeState = JSON.parse(persistedStateJSON);
              }
            } catch (e) {
              console.warn("Theme initialization: Failed to read/parse localStorage:", e);
            }

            if (themeState) {
              const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
              const mode = themeState.currentMode ?? (prefersDark ? "dark" : "light");
              
              if (mode === "dark") {
                root.classList.add("dark");
              } else {
                root.classList.remove("dark");
              }

              const activeStyles = themeState.styles?.[mode];
              if (activeStyles) {
                for (const [key, value] of Object.entries(activeStyles)) {
                  if (typeof value === "string") {
                    root.style.setProperty(\`--\${key}\`, value);
                  }
                }

                try {
                  const currentFonts = {
                    sans: activeStyles["font-sans"],
                    serif: activeStyles["font-serif"],
                    mono: activeStyles["font-mono"],
                  };

                  Object.entries(currentFonts).forEach(([_type, fontValue]) => {
                    if (fontValue) {
                      const fontFamily = extractFontFamily(fontValue);
                      if (fontFamily) {
                        loadGoogleFont(fontFamily, DEFAULT_FONT_WEIGHTS);
                      }
                    }
                  });
                } catch (e) {
                  console.warn("Theme Script initialization: Failed to load Google fonts:", e);
                }
              }
            } else {
              if (root.hasAttribute('style')) {
                root.removeAttribute('style');
              }
            }
          })();
        `,
			}}
			suppressHydrationWarning
		/>
	);
}
