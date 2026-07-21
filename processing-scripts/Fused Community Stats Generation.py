import pandas as pd

master_path = r"C:\Users\kphung\Documents\Temp Folder\2026_Sum_LaRC_Chicago_HAQ\dashboard\data\community_statistics\community_no2_master.parquet"
fused_path = r"C:\Users\kphung\Documents\Temp Folder\2026_Sum_LaRC_Chicago_HAQ\dashboard\data\fused\fused_hourly_by_community.csv"

master_df = pd.read_parquet(master_path)
fused_df = pd.read_csv(fused_path)

fused_df["date"] = pd.to_datetime(fused_df["date"])

fused_df = fused_df.rename(
    columns={
        "no2_estimate_mean": "NO2"
    }
)

fused_df["community"] = (
    fused_df["community"]
    .str.title()
)

fused_df["source"] = "Fused"

fused_df = fused_df[
    [
        "community",
        "date",
        "source",
        "NO2"
    ]
]

print(master_df.columns.tolist())

combined = pd.concat(
    [master_df, fused_df],
    ignore_index=True
)

output_path = r"C:\Users\kphung\Documents\Temp Folder\2026_Sum_LaRC_Chicago_HAQ\dashboard\data\community_statistics\community_no2_master_with_fused.parquet"

combined.to_parquet(
    output_path,
    index=False
)

print(f"Saved: {output_path}")