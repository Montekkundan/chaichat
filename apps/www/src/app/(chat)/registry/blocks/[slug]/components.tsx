import type { HandlerProps } from "basehub/react-rich-text"
import { Link } from "lucide-react"
import React from "react"
import { BaseCodeBlock } from "./code-block"
import { StandaloneCopyButton } from "./code-block-header"


const generateHeadingId = (children: React.ReactNode): string => {
    const text = typeof children === 'string' ? children :
        React.Children.toArray(children).join('')

    return text
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .trim()
}

export const Heading1 = ({ children, id }: HandlerProps<"h1">) => {
    const headingId = id || generateHeadingId(children)
    return (
        <h1 id={headingId} className="text-balance text-f-h1-mobile text-brand-w1 lg:text-f-h1 [&_b]:font-semibold">
            {children}
        </h1>
    )
}

export const Heading2 = ({ children, id }: HandlerProps<"h2">) => {
    const headingId = id || generateHeadingId(children)
    return (
        <h2 id={headingId} className="text-balance text-f-h2-mobile text-brand-w1 lg:text-f-h2 [&_b]:font-semibold">
            {children}
        </h2>
    )
}

export const Heading3 = ({ children, id }: HandlerProps<"h3">) => {
    const headingId = id || generateHeadingId(children)
    return (
        <h3 id={headingId} className="text-balance text-f-h3-mobile text-brand-w1 lg:text-f-h3 [&_b]:font-semibold">
            {children}
        </h3>
    )
}

export const BlogLink = ({
    children,
    href,
    target,
    rel
}: HandlerProps<"a">) => (
    <Link
        href={href}
        target={target as "_blank" | "_self"}
        {...(rel && { rel })}
        className="font-semibold text-brand-o underline"
    >
        {children}
    </Link>
)

export const OrderedList = ({ children }: HandlerProps<"ol">) => (
    <ol className="list-decimal pl-5 text-brand-w2 marker:text-brand-o [&_ol]:marker:!text-brand-g1">
        {children}
    </ol>
)

export const UnorderedList = ({ children }: HandlerProps<"ul">) => (
    <ul className="blog-list list-none pl-5 text-brand-w2 marker:text-brand-o [&_ul]:marker:!text-brand-g1">
        {children}
    </ul>
)

export const ListItem = ({ children }: HandlerProps<"li">) => (
    <li className="blog-list-item pl-2 text-brand-w2 marker:text-f-p-mobile lg:text-f-p">
        {children}
    </li>
)

export const Code = ({ children }: HandlerProps<"code">) => (
    <code className="md:tracking-2 rounded-md border border-brand-g2 bg-codeblock-k2 px-1 font-mono text-f-p-mobile font-semibold lg:text-f-p">
        {children}
    </code>
)

export const Pre = ({ language, code }: HandlerProps<"pre">) => (
    <div className="w-full overflow-hidden group">
        <BaseCodeBlock
            snippets={[{ code: `${code}`, language: language, id: "1" }]}
            childrenTop={<div className="relative"><StandaloneCopyButton code={code} /></div>}
            // childrenBottom={
            //     // @ts-expect-error wokaround for the fact that the language is not typed correctly
            //     language !== "text" ? (
            //         <div className="border-t border-brand-w1/30 p-3 text-f-p-mobile text-brand-g1 lg:text-f-p flex items-center gap-2">
            //             <span>{language || "Unknown"}</span>
            //         </div>
            //     ) : null
            // }
            singleFile={true}
        />
    </div>
)