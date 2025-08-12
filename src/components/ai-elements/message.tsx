import type { UIMessage } from "ai";
import type { ComponentProps, HTMLAttributes } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
	from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
	<div
		className={cn(
			"group flex w-full items-end px-2 pt-4",
            from === "user"
                ? "is-user flex-col items-end"
                : "is-assistant justify-start",
			// '[&>div]:max-w-[70%]',
			className,
		)}
		{...props}
	/>
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
	children,
	className,
	...props
}: MessageContentProps) => (
	<div
		className={cn(
			"flex flex-col gap-2 overflow-hidden px-4 py-3 text-foreground text-md",
			"group-[.is-assistant]:mr-auto group-[.is-user]:ml-auto",
			"group-[.is-user]:rounded-3xl group-[.is-user]:bg-secondary group-[.is-user]:text-primary",
			"group-[.is-assistant]:text-foreground",
			className,
		)}
		{...props}
	>
		<div className="is-user:dark">{children}</div>
	</div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
	src: string;
	name?: string;
};

export const MessageAvatar = ({
	src,
	name,
	className,
	...props
}: MessageAvatarProps) => (
	<Avatar className={cn("size-8 ring-1 ring-border", className)} {...props}>
		<AvatarImage alt="" className="mt-0 mb-0" src={src} />
		<AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
	</Avatar>
);
