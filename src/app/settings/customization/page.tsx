import { ThemeSelector } from "~/components/theme-selector";

export default function CustomizationPage() {
	return (
		<div className="container mx-auto max-w-md py-8">
			<h1 className="mb-4 font-semibold text-2xl tracking-tight">Appearance</h1>
			<ThemeSelector />
		</div>
	);
}
