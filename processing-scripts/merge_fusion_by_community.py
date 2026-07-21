
r"""
Merge fusion NO2 grid data by Chicago community area while keeping the original
temporal resolution.

Input fusion CSV expected columns:
    x              latitude
    y              longitude
    time           timestamp
    no2_estimate   NO2 estimate

Community GeoJSON:
    C:\Users\kphung\Documents\Temp Folder\community_areas.geojson

Output:
    One row per community area per timestamp.

"""

import argparse
from pathlib import Path

import pandas as pd
import geopandas as gpd


DEFAULT_COMMUNITY_GEOJSON = r"C:\Users\kphung\Documents\Temp Folder\community_areas.geojson"

COMMUNITY_NAME_CANDIDATES = [
    "community",
    "COMMUNITY",
    "community_name",
    "COMMUNITY_NAME",
    "name",
    "NAME",
    "area_name",
    "AREA_NAME",
]

COMMUNITY_ID_CANDIDATES = [
    "area_num_1",
    "AREA_NUM_1",
    "area_numbe",
    "AREA_NUMBE",
    "area_num",
    "AREA_NUM",
    "community_id",
    "COMMUNITY_ID",
]


def pick_first_existing_column(columns, candidates, label):
    """
    Pick the first column that exists in the GeoJSON.
    """
    for candidate in candidates:
        if candidate in columns:
            return candidate

    raise ValueError(
        f"Could not find a {label} column.\n"
        f"Tried: {candidates}\n"
        f"Available columns: {list(columns)}"
    )


def normalize_community_crs(communities):
    """
    Community area GeoJSON files are usually EPSG:4326.
    If CRS is missing, assume EPSG:4326.
    """
    if communities.crs is None:
        print("Community GeoJSON has no CRS. Assuming EPSG:4326.")
        communities = communities.set_crs("EPSG:4326")
    else:
        communities = communities.to_crs("EPSG:4326")

    return communities


def load_fusion_points(fusion_csv):
    """
    Load fusion CSV and convert x/y into latitude/longitude point geometries.
    """
    print("Reading fusion CSV...")
    df = pd.read_csv(fusion_csv)

    # Drop any accidental pandas index column.
    unnamed_cols = [col for col in df.columns if str(col).startswith("Unnamed")]
    if unnamed_cols:
        df = df.drop(columns=unnamed_cols)

    required_cols = ["x", "y", "time", "no2_estimate"]
    missing_cols = [col for col in required_cols if col not in df.columns]

    if missing_cols:
        raise ValueError(
            f"Fusion CSV is missing required columns: {missing_cols}\n"
            f"Found columns: {list(df.columns)}"
        )
    
    df["latitude"] = pd.to_numeric(df["x"], errors="coerce")
    df["longitude"] = pd.to_numeric(df["y"], errors="coerce")
    df["no2_estimate"] = pd.to_numeric(df["no2_estimate"], errors="coerce")
    df["time"] = pd.to_datetime(df["time"], errors="coerce")

    before_count = len(df)

    df = df.dropna(
        subset=[
            "latitude",
            "longitude",
            "time",
            "no2_estimate",
        ]
    ).copy()

    print(f"Rows read: {before_count:,}")
    print(f"Rows after cleaning: {len(df):,}")

    points = gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df["longitude"], df["latitude"]),
        crs="EPSG:4326",
    )

    return points


def load_communities(community_geojson, community_name_col=None, community_id_col=None):
    """
    Load community polygons and standardize columns to:
        community_id
        community
        geometry
    """
    print("Reading community areas...")
    communities = gpd.read_file(community_geojson)
    communities = normalize_community_crs(communities)

    if community_name_col is None:
        community_name_col = pick_first_existing_column(
            communities.columns,
            COMMUNITY_NAME_CANDIDATES,
            "community name",
        )
    elif community_name_col not in communities.columns:
        raise ValueError(
            f"Community name column '{community_name_col}' not found.\n"
            f"Available columns: {list(communities.columns)}"
        )

    if community_id_col is None:
        community_id_col = None
        for candidate in COMMUNITY_ID_CANDIDATES:
            if candidate in communities.columns:
                community_id_col = candidate
                break
    elif community_id_col not in communities.columns:
        raise ValueError(
            f"Community ID column '{community_id_col}' not found.\n"
            f"Available columns: {list(communities.columns)}"
        )

    keep_cols = [community_name_col, "geometry"]

    if community_id_col:
        keep_cols.insert(0, community_id_col)

    communities = communities[keep_cols].copy()

    communities = communities.rename(
        columns={
            community_name_col: "community",
        }
    )

    if community_id_col:
        communities = communities.rename(
            columns={
                community_id_col: "community_id",
            }
        )
    else:
        communities["community_id"] = pd.NA

    communities = communities[
        [
            "community_id",
            "community",
            "geometry",
        ]
    ]

    print(f"Community areas loaded: {len(communities):,}")
    print(f"Community name column used: {community_name_col}")

    if community_id_col:
        print(f"Community ID column used: {community_id_col}")
    else:
        print("No community ID column found. community_id will be blank.")

    return communities


def merge_fusion_by_community(
    fusion_csv,
    community_geojson,
    out_csv,
    out_joined_csv=None,
    community_name_col=None,
    community_id_col=None,
):
    """
    Spatially assign fusion grid points to communities and aggregate by:
        community_id, community, time
    """
    fusion_csv = Path(fusion_csv)
    community_geojson = Path(community_geojson)
    out_csv = Path(out_csv)

    if not fusion_csv.exists():
        raise FileNotFoundError(f"Fusion CSV not found: {fusion_csv}")

    if not community_geojson.exists():
        raise FileNotFoundError(f"Community GeoJSON not found: {community_geojson}")

    points = load_fusion_points(fusion_csv)

    communities = load_communities(
        community_geojson=community_geojson,
        community_name_col=community_name_col,
        community_id_col=community_id_col,
    )

    print("Spatially joining fusion points to community areas...")

    joined = gpd.sjoin(
        points,
        communities,
        how="inner",
        predicate="within",
    )

    print(f"Matched point rows: {len(joined):,}")

    if len(joined) == 0:
        print("Warning: no fusion points matched community polygons.")
        print("Check that x is latitude, y is longitude, and both datasets use EPSG:4326.")

    if out_joined_csv:
        out_joined_csv = Path(out_joined_csv)
        out_joined_csv.parent.mkdir(parents=True, exist_ok=True)

        joined_export = joined.drop(
            columns=["geometry", "index_right"],
            errors="ignore",
        )

        joined_export.to_csv(out_joined_csv, index=False)
        print(f"Wrote point-level joined CSV: {out_joined_csv}")

    print("Aggregating by community and timestamp...")

    grouped = (
        joined
        .groupby(
            [
                "community_id",
                "community",
                "time",
            ],
            dropna=False,
        )
        .agg(
            no2_estimate_mean=("no2_estimate", "mean"),
            no2_estimate_median=("no2_estimate", "median"),
            no2_estimate_min=("no2_estimate", "min"),
            no2_estimate_max=("no2_estimate", "max"),
            grid_cell_count=("no2_estimate", "size"),
        )
        .reset_index()
    )

    grouped["date"] = grouped["time"].dt.date.astype(str)
    grouped["hour"] = grouped["time"].dt.hour

    grouped = grouped[
        [
            "community_id",
            "community",
            "time",
            "date",
            "hour",
            "no2_estimate_mean",
            "no2_estimate_median",
            "no2_estimate_min",
            "no2_estimate_max",
            "grid_cell_count",
        ]
    ]

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    grouped.to_csv(out_csv, index=False)

    print("Done.")
    print(f"Wrote community-level output: {out_csv}")
    print(f"Output rows: {len(grouped):,}")
    print(f"Communities represented: {grouped['community'].nunique():,}")
    print(f"Timestamps represented: {grouped['time'].nunique():,}")


def main():
    parser = argparse.ArgumentParser(
        description="Merge fusion NO2 data by community area while preserving timestamp resolution."
    )

    parser.add_argument(
        "--fusion-csv",
        required=True,
        help="Path to fused_hourly_regrid.csv",
    )

    parser.add_argument(
        "--communities",
        default=DEFAULT_COMMUNITY_GEOJSON,
        help="Path to community_areas.geojson",
    )

    parser.add_argument(
        "--out-csv",
        required=True,
        help="Output CSV path",
    )

    parser.add_argument(
        "--out-joined-csv",
        default=None,
        help="Optional point-level output with matched community for each fusion grid point",
    )

    parser.add_argument(
        "--community-name-col",
        default=None,
        help="Optional exact community name column in the GeoJSON",
    )

    parser.add_argument(
        "--community-id-col",
        default=None,
        help="Optional exact community ID column in the GeoJSON",
    )

    args = parser.parse_args()

    merge_fusion_by_community(
        fusion_csv=args.fusion_csv,
        community_geojson=args.communities,
        out_csv=args.out_csv,
        out_joined_csv=args.out_joined_csv,
        community_name_col=args.community_name_col,
        community_id_col=args.community_id_col,
    )


if __name__ == "__main__":
    main()