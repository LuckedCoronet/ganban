/** Basic structure of package.json object */
type PackageConfigLike = {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
};

/** Extracts properties with keys starting with '@minecraft/*' from type T */
type ExtractMinecraftPackages<T> = {
	[K in keyof T as K extends `@minecraft/${string}` ? K : never]: T[K];
};

/** Defines the type of `@minecraft/*` packages and their versions, dependent on the package.json type T */
type MinecraftPackageVersions<T extends PackageConfigLike> = ExtractMinecraftPackages<
	NonNullable<T["dependencies"]>
> &
	ExtractMinecraftPackages<NonNullable<T["devDependencies"]>>;

/**
 * Extracts and returns `@minecraft/*` package version information from a package.json object.
 */
export const getMinecraftPackageVersions = <T extends PackageConfigLike>(
	packageConfig: T,
): MinecraftPackageVersions<T> => {
	// Merge dependencies and devDependencies (use empty objects if not present)
	const allDependencies = {
		...(packageConfig.dependencies ?? {}),
		...(packageConfig.devDependencies ?? {}),
	};

	// Filter dependencies with keys starting with '@minecraft/*'
	const minecraftEntries = Object.entries(allDependencies).filter(([key]) =>
		key.startsWith("@minecraft/"),
	);

	// Convert the extracted entries back into an object and assert the type
	return Object.fromEntries(minecraftEntries) as MinecraftPackageVersions<T>;
};
