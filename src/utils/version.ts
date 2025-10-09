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

/**
 * Parses a "major.minor.patch" version string into a number array.
 * Throws an error if the format is invalid or parts aren't integers.
 */
export const parseVersionString = (versionString: string): number[] => {
	// Split into parts.
	const parts = versionString.split(".");

	// Must have exactly three parts.
	if (parts.length !== 3) {
		throw new Error(
			'Invalid format: The string must contain exactly three integer parts separated by dots (e.g., "1.2.3").',
		);
	}

	// Convert and validate each part as an integer.
	const numbers = parts.map((part) => {
		const num = Number(part);

		// Check for empty string (e.g., "1..3") or non-integer. NaN is also caught by !Number.isInteger.
		if (part.trim() === "" || !Number.isInteger(num)) {
			throw new Error(`Invalid format: The segment "${part}" is not a valid integer.`);
		}

		return num;
	});

	return numbers;
};
