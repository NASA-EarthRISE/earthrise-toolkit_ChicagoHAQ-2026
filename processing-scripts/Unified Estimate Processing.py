#!/usr/bin/env python3
"""
Unified Fusion Processing Pipeline

1. Base CSV to Grid‑Cell GeoJSONs (hourly/daily/monthly)
2. Base CSV to 0.01° regridded hourly CSV (estimate_hourly_regrid.csv)
3. Regridded CSV to Community aggregation CSV (estimate_hourly_by_community.csv)

Usage:
    python process_fusion.py \
        --csv monthly-no2-estimates.csv \
        --communities ChicagoCommunityAreas.geojson \
        --output ./data/estimate \
        --chunksize 100000
"""

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import pandas as pd
import geopandas as gpd
import numpy as np
import xarray as xr
from shapely.geometry import Polygon, mapping


# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------
GRID_HALF_SIZE_DEGREES = 0.01     # Square grid-cell half-width
REQUIRED_COLUMNS = ["datetime", "latitude", "longitude", "no2_estimate"]


# ----------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def clean_float(value):
    try:
        value = float(value)
    except Exception:
        return None
    if math.isnan(value) or math.isinf(value):
        return None
    return value


def make_square(lon, lat, d=GRID_HALF_SIZE_DEGREES):
    """Build a square polygon around a point."""
    return Polygon([
        (lon - d, lat - d),
        (lon + d, lat - d),
        (lon + d, lat + d),
        (lon - d, lat + d),
        (lon - d, lat - d),
    ])


def normalize_chunk_dates(df):
    """Add datetime_utc, local_date, local_month, and hour fields."""
    parsed = pd.to_datetime(df["datetime"], errors="coerce")
    df["datetime_utc"]   = parsed.dt.strftime("%Y-%m-%dT%H:%M:%S")
    df["datetime_local"] = parsed.dt.strftime("%Y-%m-%d %H:%M:%S")
    df["local_date"]     = parsed.dt.strftime("%Y-%m-%d")
    df["local_month"]    = parsed.dt.strftime("%Y-%m")
    df["local_hour"]     = parsed.dt.hour
    return df


def update_aggregate(stats, period, lat, lon, value):
    """Aggregate (sum,count) for daily/monthly averages."""
    lat_key = round(float(lat), 6)
    lon_key = round(float(lon), 6)
    key = (period, lat_key, lon_key)
    stats[key]["sum"]   += float(value)
    stats[key]["count"] += 1


def write_fc(path, features):
    """Write a GeoJSON FeatureCollection."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f)


# ----------------------------------------------------------------------------
# 1. GRID CELL GeoJSON GENERATION
# ----------------------------------------------------------------------------
def stage1_generate_grid_geojsons(csv_path, output_dir, chunksize):

    writers = {}
    seen_dates = set()
    seen_months = set()

    daily_stats   = defaultdict(lambda: {"sum": 0.0, "count": 0})
    monthly_stats = defaultdict(lambda: {"sum": 0.0, "count": 0})

    rows_total = 0
    rows_valid = 0

    print("\n1: Base CSV → Grid‑Cell GeoJSONs")

    for chunk_idx, chunk in enumerate(pd.read_csv(csv_path, chunksize=chunksize), start=1):

        # Check required columns
        missing = [c for c in REQUIRED_COLUMNS if c not in chunk.columns]
        if missing:
            raise ValueError(f"Missing columns: {missing}")

        rows_total += len(chunk)

        chunk = normalize_chunk_dates(chunk.copy())
        chunk["latitude"]     = pd.to_numeric(chunk["latitude"],     errors="coerce")
        chunk["longitude"]    = pd.to_numeric(chunk["longitude"],    errors="coerce")
        chunk["no2_estimate"] = pd.to_numeric(chunk["no2_estimate"], errors="coerce")

        chunk = chunk.dropna(subset=[
            "datetime_utc","local_date","local_month",
            "latitude","longitude","no2_estimate"
        ])

        for _, row in chunk.iterrows():
            lat = clean_float(row["latitude"])
            lon = clean_float(row["longitude"])
            no2 = clean_float(row["no2_estimate"])
            if lat is None or lon is None or no2 is None:
                continue

            # Build grid-cell polygon feature
            feature = {
                "type": "Feature",
                "geometry": mapping(make_square(lon, lat)),
                "properties": {
                    "datetime":     row["datetime_utc"],
                    "latitude":     lat,
                    "longitude":    lon,
                    "no2_estimate": no2,
                }
            }

            local_date  = row["local_date"]
            local_month = row["local_month"]

            seen_dates.add(local_date)
            seen_months.add(local_month)

            # Write hourly/daily file for each date
            daily_path = output_dir / f"{local_date}.geojson"
            if local_date not in writers:
                fp = open(daily_path, "w", encoding="utf-8")
                fp.write('{"type":"FeatureCollection","features":[\n')
                writers[local_date] = fp
            else:
                writers[local_date].write(",\n")

            writers[local_date].write(json.dumps(feature))
            rows_valid += 1

            update_aggregate(daily_stats,   local_date,  lat, lon, no2)
            update_aggregate(monthly_stats, local_month, lat, lon, no2)

        print(f"1. Chunk {chunk_idx}: {len(chunk)} valid rows")

    # Close hourly/daily writers
    for fp in writers.values():
        fp.write("\n]}")
        fp.close()

    sorted_dates  = sorted(seen_dates)
    sorted_months = sorted(seen_months)

    # Write date lists
    with open(output_dir / "dates.json", "w") as f:
        json.dump({"dates": sorted_dates, "months": sorted_months}, f, indent=2)

    with open(output_dir / "estimate_dates.json", "w") as f:
        json.dump({"dates": sorted_dates, "months": sorted_months}, f, indent=2)

    # Daily aggregate → day_YYYY-MM-DD.geojson
    for date in sorted_dates:
        features = []
        for (period, lat, lon), stats in daily_stats.items():
            if period != date or stats["count"] <= 0:
                continue
            avg = stats["sum"] / stats["count"]
            features.append({
                "type": "Feature",
                "geometry": mapping(make_square(lon, lat)),
                "properties": {
                    "period":       date,
                    "period_type": "daily",
                    "latitude":     lat,
                    "longitude":    lon,
                    "no2_estimate": avg,
                    "count":        stats["count"],
                },
            })
        write_fc(output_dir / f"day_{date}.geojson", features)

    # Monthly aggregate → month_YYYY-MM.geojson
    for month in sorted_months:
        features = []
        for (period, lat, lon), stats in monthly_stats.items():
            if period != month or stats["count"] <= 0:
                continue
            avg = stats["sum"] / stats["count"]
            features.append({
                "type": "Feature",
                "geometry": mapping(make_square(lon, lat)),
                "properties": {
                    "period":       month,
                    "period_type": "monthly",
                    "latitude":     lat,
                    "longitude":    lon,
                    "no2_estimate": avg,
                    "count":        stats["count"],
                },
            })
        write_fc(output_dir / f"month_{month}.geojson", features)

    # Metadata
    metadata = {
        "source_csv": str(csv_path),
        "rows_read": rows_total,
        "valid_rows": rows_valid,
        "date_count": len(sorted_dates),
        "month_count": len(sorted_months),
        "first_date": sorted_dates[0] if sorted_dates else None,
        "last_date":  sorted_dates[-1] if sorted_dates else None,
    }
    with open(output_dir / "metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print("STEP 1 COMPLETE")
    return sorted_dates, sorted_months


# ----------------------------------------------------------------------------
# 2. 0.01° REGRID 
# ----------------------------------------------------------------------------
def stage2_regrid(csv_path, output_dir):

    print("\n2.CSV → 0.01° Regrid CSV")

    df = pd.read_csv(csv_path)
    df["datetime"] = pd.to_datetime(df["datetime"])

    ds = df.set_index(["datetime", "latitude", "longitude"]).to_xarray()

    # Hourly mean
    ds_hourly = ds.resample(datetime="1h").mean()

    # Build grid boundaries
    x_min = float(ds_hourly.longitude.min())
    x_max = float(ds_hourly.longitude.max())
    y_min = float(ds_hourly.latitude.min())
    y_max = float(ds_hourly.latitude.max())

    spacing = 0.01
    new_x = np.arange(x_min, x_max + spacing/2, spacing)
    new_y = np.arange(y_max, y_min - spacing/2, -spacing)

    ds_grid = ds_hourly.interp(coords={"longitude": new_x,
                                       "latitude": new_y},
                               method="nearest")

    df_grid = ds_grid.to_dataframe().reset_index()
    df_grid = df_grid.dropna(subset=["no2_estimate"])

    out_csv = output_dir / "estimate_hourly_regrid.csv"
    df_grid[["datetime", "latitude", "longitude", "no2_estimate"]].to_csv(out_csv, index=False)

    print("STEP 2 COMPLETE:", out_csv)
    return out_csv


#----------------------------------------------------------------------------
# 3. COMMUNITY AGGREGATION
# ---------------------------------------------------------------------------
def stage3_community(regrid_csv, communities, output_dir):

    print("\nSTEP 3: Regrid CSV → Community Aggregation CSV")

    df = pd.read_csv(regrid_csv)
    df = df.dropna(subset=["datetime","latitude","longitude","no2_estimate"])

    points = gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df["longitude"], df["latitude"]),
        crs="EPSG:4326"
    )

    comm = gpd.read_file(communities)

    # Detect name/id fields
    name_fields = ["community","COMMUNITY","community_name","name","NAME"]
    id_fields   = ["community_id","area_numbe","AREA_NUMBE","area_number","AREA_NUMBER"]

    def first_present(row, fields):
        for f in fields:
            if f in row and pd.notna(row[f]):
                return row[f]
        return None

    comm["community_display"] = comm.apply(lambda r: first_present(r,name_fields), axis=1)
    comm["community_id"]      = comm.apply(lambda r: first_present(r,id_fields),   axis=1)

    joined = gpd.sjoin(
        points,
        comm[["community_display","community_id","geometry"]],
        how="inner",
        predicate="within"
    )

    agg = (
        joined.groupby(["community_id","community_display","datetime"])
        .agg(no2_estimate_mean=("no2_estimate","mean"),
             no2_estimate_median=("no2_estimate","median"),
             no2_estimate_min=("no2_estimate","min"),
             no2_estimate_max=("no2_estimate","max"),
             grid_cell_count=("no2_estimate","size"))
        .reset_index()
    )

    final = agg.rename(columns={"community_display":"community"})[
        ["community_id","community","datetime",
         "no2_estimate_mean","no2_estimate_median","no2_estimate_min",
         "no2_estimate_max","grid_cell_count"]
    ]

    out_csv = output_dir / "fused_hourly_by_community.csv"
    final.to_csv(out_csv, index=False)

    print("STEP3 COMPLETE:", out_csv)
    return out_csv


#----------------------------------------------------------------------------
# MAIN 
# ----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Unified Estimate Processing Pipeline")
    parser.add_argument("--input", required=True, help="Base Estimate CSV: monthly-no2-estimates.csv")
    parser.add_argument("--communities", required=True, help="ChicagoCommunityAreas.geojson")
    parser.add_argument("--output", required=True, help="Output folder")
    parser.add_argument("--chunksize", type=int, default=100000)

    args = parser.parse_args()
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. grid-cell files
    dates, months = stage1_generate_grid_geojsons(args.input, output_dir, args.chunksize)

    # 2. regrid to 0.01° CSV
    regrid_csv = stage2_regrid(args.input, output_dir)

    # 3. community aggregation
    stage3_community(regrid_csv, args.communities, output_dir)

    print("\nEstimate processing complete!")
    print("Output directory:", output_dir)


if __name__ == "__main__":
    main()
