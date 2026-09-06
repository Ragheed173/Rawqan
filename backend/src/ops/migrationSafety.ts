export interface MigrationDirectory {
  name: string;
  sequence: number;
}

export const DESTRUCTIVE_LEGACY_MIGRATIONS = new Set([
  "8_prelaunch_pos_data_cleanup",
  "9_final_pos_trial_data_cleanup",
  "13_customer_handover_pos_cleanup",
]);

export function orderNumericMigrations(names: string[]): MigrationDirectory[] {
  const migrations = names
    .filter((name) => /^\d+_/.test(name))
    .map((name) => ({
      name,
      sequence: Number(name.match(/^(\d+)_/)?.[1]),
    }))
    .sort((left, right) =>
      left.sequence === right.sequence
        ? left.name.localeCompare(right.name)
        : left.sequence - right.sequence,
    );

  if (
    migrations.length === 0 ||
    migrations.some(({ sequence }) => !Number.isSafeInteger(sequence))
  ) {
    throw new Error("No valid numerically prefixed migrations were found.");
  }

  const sequences = migrations.map(({ sequence }) => sequence);
  if (new Set(sequences).size !== sequences.length) {
    throw new Error("Migration numeric prefixes must be unique.");
  }

  migrations.forEach(({ sequence, name }, index) => {
    if (sequence !== index) {
      throw new Error(
        `Migration sequence must be contiguous from zero; found ${name}.`,
      );
    }
  });

  return migrations;
}

export function pendingDestructiveMigrations(
  migrations: MigrationDirectory[],
  appliedNames: Set<string>,
) {
  return migrations
    .map(({ name }) => name)
    .filter(
      (name) =>
        !appliedNames.has(name) && DESTRUCTIVE_LEGACY_MIGRATIONS.has(name),
    );
}
