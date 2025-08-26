"use client";

import { CheckIcon, CopyIcon, Maximize2Icon, Minimize2Icon } from "lucide-react";
import * as React from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type RegistryCodeBlockProps = React.HTMLAttributes<HTMLDivElement> & {
    code: string;
    language: string;
    title?: string;
    defaultCollapsed?: boolean;
    collapsedMaxHeight?: number | string;
};

type HighlighterModule = typeof import("react-syntax-highlighter");
type PrismStyle = Record<string, React.CSSProperties>;

export function RegistryCodeBlock({
    code,
    language,
    title,
    defaultCollapsed = true,
    collapsedMaxHeight = 300,
    className,
    ...props
}: RegistryCodeBlockProps) {
    const [isCollapsed, setIsCollapsed] = React.useState<boolean>(defaultCollapsed);
    const [copied, setCopied] = React.useState(false);
    const [Highlighter, setHighlighter] = React.useState<HighlighterModule["Prism"] | null>(null);
    const [lightStyle, setLightStyle] = React.useState<PrismStyle | null>(null);
    const [darkStyle, setDarkStyle] = React.useState<PrismStyle | null>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [expandedHeight, setExpandedHeight] = React.useState<string>("2000px");

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1400);
        } catch {}
    };

    const maxHeight = typeof collapsedMaxHeight === "number" ? `${collapsedMaxHeight}px` : collapsedMaxHeight;

    const ensureHighlighter = React.useCallback(async () => {
        if (Highlighter) return;
        const mod = await import("react-syntax-highlighter");
        const styles = await import("react-syntax-highlighter/dist/esm/styles/prism");
        setHighlighter(() => mod.Prism);
        setLightStyle(styles.oneLight as unknown as PrismStyle);
        setDarkStyle(styles.oneDark as unknown as PrismStyle);
    }, [Highlighter]);

    React.useEffect(() => {
        void ensureHighlighter();
    }, [ensureHighlighter]);
    
    const recalc = React.useCallback(() => {
        const el = contentRef.current;
        if (!el) return;
        const h = el.scrollHeight;
        if (h > 0) setExpandedHeight(`${h}px`);
    }, []);

    React.useEffect(() => {
        recalc();
    }, [recalc]);

    return (
        <div
            className={cn(
                "relative w-full overflow-hidden rounded-md border bg-background text-foreground",
                className,
            )}
            onMouseEnter={() => { void ensureHighlighter(); }}
            {...props}
        >
            <div className="flex items-center justify-between border-b px-3 py-2">
                <div className="truncate font-mono text-xs" title={title}>{title}</div>
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={copy}
                        aria-label="Copy code"
                        title={copied ? "Copied" : "Copy"}
                    >
                        {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => { void ensureHighlighter(); setIsCollapsed((p) => !p); }}
                        aria-label={isCollapsed ? "Expand" : "Collapse"}
                        title={isCollapsed ? "Expand" : "Collapse"}
                    >
                        {isCollapsed ? <Maximize2Icon size={14} /> : <Minimize2Icon size={14} />}
                    </Button>
                </div>
            </div>
            <div
                className={cn(
                    "relative transition-[max-height] duration-100 ease-in-out",
                    isCollapsed && "overflow-hidden",
                )}
                style={isCollapsed ? { maxHeight } : { maxHeight: expandedHeight }}
            >
                <div ref={contentRef}>
                {Highlighter && lightStyle ? (
                <Highlighter
                    language={language}
                    style={lightStyle}
                    customStyle={{
                        margin: 0,
                        padding: "1rem",
                        fontSize: "0.875rem",
                        background: "hsl(var(--background))",
                        color: "hsl(var(--foreground))",
                    }}
                    codeTagProps={{ className: "font-mono text-sm" }}
                    className="overflow-hidden dark:hidden"
                >
                    {code}
                </Highlighter>
                ) : (
                <pre className="m-0 overflow-auto p-4 font-mono text-sm">{code}</pre>
                )}
                {Highlighter && darkStyle ? (
                <Highlighter
                    language={language}
                    style={darkStyle}
                    customStyle={{
                        margin: 0,
                        padding: "1rem",
                        fontSize: "0.875rem",
                        background: "hsl(var(--background))",
                        color: "hsl(var(--foreground))",
                    }}
                    codeTagProps={{ className: "font-mono text-sm" }}
                    className="hidden overflow-hidden dark:block"
                >
                    {code}
                </Highlighter>
                ) : null}
                </div>
                {isCollapsed && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
                )}
            </div>
        </div>
    );
}


