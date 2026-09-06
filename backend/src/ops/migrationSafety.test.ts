import { describe, expect, it } from "vitest";
import {
  orderNumericMigrations,
  pendingDestructiveMigrations,
} from "./migrationSafety.js";

describe("migration safety", () => {
  it("orders the immutable unpadded migration names numerically", () => {
    expect(
      orderNumericMigrations([
        "10_ten",
        "3_three",
        "8_eight",
        "2_two",
        "6_six",
        "1_one",
        "9_nine",
        "4_four",
        "0_zero",
        "7_seven",
        "5_five",
      ]),
    ).toEqual([
      { name: "0_zero", sequence: 0 },
      { name: "1_one", sequence: 1 },
      { name: "2_two", sequence: 2 },
      { name: "3_three", sequence: 3 },
      { name: "4_four", sequence: 4 },
      { name: "5_five", sequence: 5 },
      { name: "6_six", sequence: 6 },
      { name: "7_seven", sequence: 7 },
      { name: "8_eight", sequence: 8 },
      { name: "9_nine", sequence: 9 },
      { name: "10_ten", sequence: 10 },
    ]);
  });

  it("refuses gaps and duplicate numeric prefixes", () => {
    expect(() => orderNumericMigrations(["0_zero", "2_two"])).toThrow(
      "contiguous",
    );
    expect(() =>
      orderNumericMigrations(["0_zero", "1_one", "1_other"]),
    ).toThrow("unique");
  });

  it("identifies only pending historical cleanup migrations", () => {
    const migrations = orderNumericMigrations([
      "0_init",
      "1_media",
      "2_login",
      "3_pos",
      "4_database",
      "5_app",
      "6_split",
      "7_prices",
      "8_prelaunch_pos_data_cleanup",
      "9_final_pos_trial_data_cleanup",
      "10_pos_cache_epoch",
      "11_catalog",
      "12_ack",
      "13_customer_handover_pos_cleanup",
    ]);

    expect(
      pendingDestructiveMigrations(
        migrations,
        new Set(["8_prelaunch_pos_data_cleanup"]),
      ),
    ).toEqual([
      "9_final_pos_trial_data_cleanup",
      "13_customer_handover_pos_cleanup",
    ]);
  });
});
