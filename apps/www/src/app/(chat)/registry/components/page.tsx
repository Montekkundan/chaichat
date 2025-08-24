import { DocsShell, DocsSidebar } from "~/components/registry/registry-layout";
import { readAllRegistryItems } from "~/lib/registry";

export default async function ComponentsIndexPage() {
	const items = (await readAllRegistryItems()).filter(
		(i) => i.type?.includes("component") || i.type?.includes("ui"),
	);
	return (
		<DocsShell
			title="Components"
			sidebar={
				<DocsSidebar
					items={items.map((i) => ({ slug: i.name, title: i.title }))}
					title="Components"
				/>
			}
		>
			{items.length === 0 ? (
				<div className="text-muted-foreground">No components yet.</div>
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					{items.map((i) => (
						<a
							key={i.name}
							href={`/registry/components/${i.name}`}
							className="rounded-lg border p-4 hover:bg-accent"
						>
							<div className="font-medium">{i.title}</div>
							<div className="text-muted-foreground text-sm">{i.description}</div>
						</a>
					))}
				</div>
			)}
		</DocsShell>
	);
}


