import { CodeBlock, createCssVariablesTheme } from "basehub/react-code-block"
import type { ComponentProps, ReactNode } from "react"

import { cn } from "~/lib/utils"

import styles from "./code-block.module.css"

interface CodeBlockProps {
  snippets: ComponentProps<typeof CodeBlock>["snippets"]
  childrenTop?: ReactNode
  childrenBottom?: ReactNode
  singleFile?: boolean
}

const theme = createCssVariablesTheme({
  name: "chaichat",
  variablePrefix: "--chai-",
  variableDefaults: {
    "color-text": "var(--chai-color-text)",
    "token-constant": "var(--chai-token-constant)",
    "token-string": "var(--chai-token-string)",
    "token-comment": "var(--chai-token-comment)",
    "token-keyword": "var(--chai-token-keyword)",
    "token-parameter": "var(--chai-token-parameter)",
    "token-function": "var(--chai-token-function)",
    "token-string-expression": "var(--chai-token-string-expression)",
    "token-punctuation": "var(--chai-token-punctuation)",
    "token-link": "var(--chai-token-link)",
    "token-tag": "var(--chai-token-tag)",
    "token-tag-name": "var(--chai-token-tag-name)",
    "token-attr-name": "var(--chai-token-attr-name)",
    "token-attr-value": "var(--chai-token-attr-value)",
    "token-operator": "var(--chai-token-operator)",
    "token-builtin": "var(--chai-token-builtin)",
    "token-class-name": "var(--chai-token-class-name)"
  },
  fontStyle: true
})

export const BaseCodeBlock = ({
  childrenTop,
  childrenBottom,
  snippets,
}: CodeBlockProps) => {
  // const hasTextLanguage = snippets.some((snippet) => snippet.language === "text");

  return (
    <CodeBlock
      childrenTop={childrenTop}
      childrenBottom={childrenBottom}
      snippets={snippets}
      theme={theme}
      components={{
        div: ({ children, ...rest }: { children?: ReactNode }) => (
          <div
            className={cn(
              styles.content,
              "border border-brand-w1/30 font-mono text-f-p-mobile lg:text-f-p bg-chai-background",
            )}
            {...rest}
          >
            {children}
          </div>
        ),
        // pre: ({ children, ...rest }: { children?: ReactNode }) => (
        //   <pre
        //     {...rest}
        //   >
        //     {children}
        //   </pre>
        // )
      }}
      // {...(!hasTextLanguage && {
      //   lineNumbers: {
      //     className: styles.line_indicator
      //   }
      // })}
    />
  )
}