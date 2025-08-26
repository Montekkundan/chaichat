import { DocsShell, DocsSidebar, DocsTOC } from "~/components/registry/registry-layout";
import { readAllRegistryItems } from "~/lib/registry";

export default async function BlocksIndexPage() {
	const items = (await readAllRegistryItems()).filter((i) => i.type?.includes("block"));

	// Define headings for the TOC
	const headings = [
		{ id: "overview", text: "Overview", level: 1 },
		{ id: "available-blocks", text: "Available Blocks", level: 2 },
	];

	return (
		<DocsShell
			title="Blocks"
			sidebar={
				<DocsSidebar
					items={items.map((i) => ({ slug: i.name, title: i.title }))}
					title="Blocks"
				/>
			}
			toc={<DocsTOC headings={headings} />}
		>
			<div className="space-y-6">
				<div>
					<h1 id="overview">Overview</h1>
					<p className="text-muted-foreground">
						Explore our collection of reusable UI blocks. Each block is designed to be easily integrated into your project and comes with comprehensive documentation.
					</p>
				</div>

				<div>
					<h2 id="available-blocks">Available Blocks</h2>
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
				</div>
			</div>
		</DocsShell>
	);
}


