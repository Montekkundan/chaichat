import { ThemeSelector } from "~/components/theme-selector";

export default function CustomizationPage() {
	return (
		<div className="container mx-auto max-w-md py-8">
			<h1 className="mb-4 text-2xl font-semibold tracking-tight">Appearance</h1>
			<ThemeSelector />
		</div>
	);
}
