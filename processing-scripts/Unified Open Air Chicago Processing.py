"""
Unified Processing Script for CLARITY / OpenAir Chicago

This script:

1. Splits the master OpenAir Chicago GeoJSON by date
2. Generates daily sensor averages
3. Generates daily community averages
4. Generates monthly community averages (Clarity/TEMPO naming)
5. Produces clarity_sensor_averages.csv
6. Produces dates.json

"""

import os
import json
import ijson
import argparse
from pathlib import Path
from collections import defaultdict

import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import Point


# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
def get_date(timestr):
    """Extract YYYY-MM-DD from the 'time' property."""
    return timestr[:10]


def safe_float(x):
    try:
        return float(x)
    except:
        return None


def find_name_field(communities):
    """Find the correct community name field."""
    for candidate in ["community", "COMMUNITY", "community_name", "name"]:
        if candidate in communities.columns:
            return candidate
    raise ValueError("Could not identify community name field in community file")


# -------------------------------------------------------------------
# 1. SPLIT MASTER GEOJSON BY DATE
# -------------------------------------------------------------------
from decimal import Decimal

def convert_decimals(obj):
    """Recursively convert Decimal objects to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, list):
        return [convert_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    return obj


def split_daily_files(input_file, outdir):
    print("Splitting OpenAir master file by date...")

    files = {}
    counts = defaultdict(int)

    with open(input_file, "rb") as f:
        features = ijson.items(f, "features.item")

        for feature in features:
            if not isinstance(feature, dict):
                continue

            props = feature.get("properties", {})
            time = props.get("time")
            if not time:
                continue

            date = get_date(time)
            out_path = outdir / f"{date}.geojson"

            if date not in files:
                fp = open(out_path, "w", encoding="utf-8")
                fp.write('{"type":"FeatureCollection","features":[\n')
                files[date] = fp
            else:
                files[date].write(",\n")

            json.dump(convert_decimals(feature), files[date])
            counts[date] += 1

    # close all
    for date, fp in files.items():
        fp.write("\n]}")
        fp.close()

    print(f"Created {len(files)} daily files.")
    return sorted(counts.keys())


# -------------------------------------------------------------------
# 2. DAILY SENSOR + DAILY COMMUNITY
# -------------------------------------------------------------------
def process_daily(dates, outdir, communities):
    name_field = find_name_field(communities)

    for date in dates:
        daily_fp = outdir / f"{date}.geojson"
        if not daily_fp.exists():
            continue

        print(f"Processing daily aggregations for {date}")

        with open(daily_fp, "r", encoding="utf-8") as f:
            data = json.load(f)

        sensor_stats = {}
        community_records = []

        for feat in data.get("features", []):
            props = feat.get("properties", {})
            lat = safe_float(props.get("latitude"))
            lon = safe_float(props.get("longitude"))
            no2 = safe_float(props.get("no2concindividual_value"))
            sensor = props.get("sensor_name")

            if None in (lat, lon, no2) or not sensor:
                continue

            sensor_stats.setdefault(sensor, {"sum": 0.0, "count": 0, "lat": lat, "lon": lon})
            sensor_stats[sensor]["sum"] += no2
            sensor_stats[sensor]["count"] += 1

            community_records.append({"sensor_name": sensor, "no2": no2, "latitude": lat, "longitude": lon})

        # DAILY SENSOR
        sensor_features = []
        for sensor, stats in sensor_stats.items():
            avg = stats["sum"] / stats["count"]
            sensor_features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [stats["lon"], stats["lat"]]},
                "properties": {"sensor_name": sensor, "avg_no2": avg, "count": stats["count"]}
            })

        with open(outdir / f"daily_sensor_{date}.geojson", "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": sensor_features}, f)

        # DAILY COMMUNITY
        community_out = communities.copy()
        community_out["avg_no2"] = None
        community_out["count"] = 0

        if community_records:
            df = pd.DataFrame(community_records)
            gdf = gpd.GeoDataFrame(
                df,
                geometry=[Point(xy) for xy in zip(df.longitude, df.latitude)],
                crs="EPSG:4326"
            )

            joined = gpd.sjoin(gdf, communities[[name_field, "geometry"]], predicate="within", how="left")
            stats = joined.groupby(name_field)["no2"].agg(["mean", "count"]).reset_index()

            for _, row in stats.iterrows():
                comm_name = row[name_field]
                community_out.loc[
                    community_out[name_field] == comm_name,
                    "avg_no2"
                ] = float(row["mean"])
                community_out.loc[
                    community_out[name_field] == comm_name,
                    "count"
                ] = int(row["count"])

        community_out.to_file(outdir / f"daily_community_{date}.geojson", driver="GeoJSON")


# -------------------------------------------------------------------
# 3. MONTHLY COMMUNITY
# -------------------------------------------------------------------
def process_monthly(dates, outdir, communities_file):
    print("Building monthly community files…")

    # group daily files by month
    monthly_files = defaultdict(list)
    for date in dates:
        month = date[:7]
        monthly_files[month].append(outdir / f"daily_community_{date}.geojson")

    communities = gpd.read_file(communities_file)
    name_field = find_name_field(communities)

    for month, files in sorted(monthly_files.items()):
        print(f"Processing month {month} ({len(files)} files)")

        all_records = []

        for fp in files:
            if not fp.exists():
                continue
            gdf = gpd.read_file(fp)
            for _, row in gdf.iterrows():
                if pd.notna(row["avg_no2"]):
                    all_records.append({
                        "community": row[name_field],
                        "avg": row["avg_no2"],
                        "count": row["count"]
                    })

        if not all_records:
            continue

        df = pd.DataFrame(all_records)
        df["avg"] = df["avg"].astype(float)
        df["count"] = df["count"].astype(float)

        final_stats = df.groupby("community").apply(
            lambda g: pd.Series({
                "avg_no2": (g["avg"] * g["count"]).sum() / g["count"].sum(),
                "count": g["count"].sum()
            })
        ).reset_index()

        merged = communities.merge(final_stats, left_on=name_field, right_on="community", how="left")
        merged.to_file(outdir / f"monthly_community_{month}.geojson", driver="GeoJSON")


# -------------------------------------------------------------------
# 4. clarity_sensor_averages.csv
# -------------------------------------------------------------------
def build_clarity_avg(outdir):
    sensor_data = defaultdict(list)

    for fp in outdir.glob("*.geojson"):
        name = fp.name
        if (
            name.startswith("daily_community") or
            name.startswith("monthly_community") or
            name.startswith("daily_sensor")
        ):
            # Only daily raw files contain the raw readings
            continue

        # These are the raw daily grid-cell files: YYYY-MM-DD.geojson
        if len(name) == len("YYYY-MM-DD.geojson"):
            with open(fp, "r", encoding="utf-8") as f:
                data = json.load(f)
            for feat in data.get("features", []):
                props = feat.get("properties", {})
                sensor = props.get("sensor_name")
                no2 = safe_float(props.get("no2concindividual_value"))
                if sensor and no2 is not None:
                    sensor_data[sensor].append(no2)

    rows = []
    for sensor, vals in sensor_data.items():
        arr = np.array(vals)
        rows.append({
            "sensor_name": sensor,
            "mean_no2_ppb": arr.mean(),
            "std_no2_ppb": arr.std(ddof=1) if len(arr) > 1 else np.nan,
            "min_no2_ppb": arr.min(),
            "max_no2_ppb": arr.max(),
            "observations": len(arr)
        })

    df = pd.DataFrame(rows)
    df.sort_values("mean_no2_ppb", ascending=False).to_csv(outdir / "clarity_sensor_averages.csv", index=False)


# -------------------------------------------------------------------
# MAIN
# -------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="CLARITY Only Unified Processing Script")
    ap.add_argument("--input", required=True, help="Master OpenAir Chicago GeoJSON")
    ap.add_argument("--communities", required=True, help="Community areas GeoJSON")
    ap.add_argument("--output", required=True, help="Output folder for clarity products")

    args = ap.parse_args()

    outdir = Path(args.output)
    outdir.mkdir(exist_ok=True, parents=True)

    print("Splitting daily files...")
    dates = split_daily_files(args.input, outdir)

    print("Loading communities:", args.communities)
    communities = gpd.read_file(args.communities)

    print("Daily aggregation...")
    process_daily(dates, outdir, communities)

    print("Monthly community aggregation...")
    process_monthly(dates, outdir, args.communities)

    print("Building clarity_sensor_averages.csv...")
    build_clarity_avg(outdir)

    print("Writing dates.json")
    with open(outdir / "dates.json", "w", encoding="utf-8") as f:
        json.dump(sorted(dates), f, indent=2)

    print("\n All CLARITY outputs generated successfully.")


if __name__ == "__main__":
    main()