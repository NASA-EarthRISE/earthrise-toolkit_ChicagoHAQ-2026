import pandas as pd

rankings_path = r"C:\Users\kphung\Documents\Temp Folder\2026_Sum_LaRC_Chicago_HAQ\dashboard\data\community_statistics\community_rankings_ground_vs_tempo.csv"

fused_path = r"C:\Users\kphung\Documents\Temp Folder\2026_Sum_LaRC_Chicago_HAQ\dashboard\data\fused\fused_hourly_by_community.csv"

# Read files
rankings_df = pd.read_csv(rankings_path)
fused_df = pd.read_csv(fused_path)

# Match naming convention
fused_df["community"] = fused_df["community"].str.title()

# Mean NO2 by community
fused_stats = (
    fused_df
    .groupby("community")["no2_estimate_mean"]
    .mean()
    .reset_index()
)

fused_stats.rename(
    columns={"no2_estimate_mean": "fused_no2_ppb"},
    inplace=True
)

# Rank highest NO2 = rank 1
fused_stats["fused_rank"] = (
    fused_stats["fused_no2_ppb"]
    .rank(method="min", ascending=False)
)

# Percentile consistent with your existing format
n = len(fused_stats)

fused_stats["fused_percentile"] = (
    (n - fused_stats["fused_rank"])
    / (n - 1)
    * 100
)

# Merge into existing rankings table
updated = rankings_df.merge(
    fused_stats[
        ["community",
         "fused_rank",
         "fused_percentile",
         "fused_no2_ppb"]
    ],
    on="community",
    how="left"
)

# Save
output_path = rankings_path.replace(
    ".csv",
    "_with_fused.csv"
)

updated.to_csv(output_path, index=False)

print(f"Saved: {output_path}")