import { DocsShell, DocsSidebar } from "~/components/registry/registry-layout";
import { readAllRegistryItems } from "~/lib/registry";

export default async function BlocksIndexPage() {
	const items = (await readAllRegistryItems()).filter((i) => i.type?.includes("block"));
	return (
		<DocsShell
			title="Blocks"
			sidebar={
				<DocsSidebar
					items={items.map((i) => ({ slug: i.name, title: i.title }))}
					title="Blocks"
				/>
			}
		>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{items.map((i) => (
					<a
						key={i.name}
						href={`/registry/blocks/${i.name}`}
						className="rounded-lg border p-4 hover:bg-accent"
					>
						<div className="font-medium">{i.title}</div>
						<div className="text-muted-foreground text-sm">{i.description}</div>
					</a>
				))}
			</div>
		</DocsShell>
	);
}


