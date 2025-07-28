import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { cn } from "~/lib/utils"
import Image from "next/image"
import { Tweet } from "react-tweet"

interface CustomTweetProps {
  id: string
}

const CustomTweet = async ({ id }: CustomTweetProps) => {
  return (
    <div className="dark mx-auto grid w-full max-w-[500px] place-items-center">
      <Tweet
        id={id}
        components={{
          AvatarImg: (props: { src: string; alt: string; width: number; height: number }) => (
            <Image
              src={props.src}
              alt={props.alt}
              width={props.width}
              height={props.height}
            />
          )
        }}
      />
    </div>
  )
}

function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    img: ({ className, alt, ...props }: React.ComponentProps<"img">) => (
      <img 
        className={cn("rounded-md border", className)} 
        alt={alt || "Image"} 
        {...props} 
      />
    ),
    Video: ({ className, ...props }: React.ComponentProps<"video">) => (
      <video
        className={cn("rounded-md border", className)}
        controls
        loop
        {...props}
      />
    ),
    YouTube: ({ videoId, className, ...props }: { videoId: string; className?: string }) => (
      <div className={cn("relative w-full aspect-video rounded-md border overflow-hidden", className)} {...props}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    ),
    CustomTweet,
    Accordion,
    AccordionItem,
    AccordionTrigger,
    AccordionContent,
    ...components,
  }
}

// Export for MDX system
export const useMDXComponents = getMDXComponents

// Default export for MDX provider
export default useMDXComponents