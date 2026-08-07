#!/usr/bin/env python3
"""
Unified TEMPO Processing Pipeline

This script produces all TEMPO products used in the Regional Ozone Precursor
Dashboard. It generates:

    Hourly grid-cell files
        YYYY-MM-DD.geojson

    Daily grid-cell files
        day_YYYY-MM-DD.geojson

    Monthly grid-cell files
        month_YYYY-MM.geojson

    Daily community averages
        day_community_YYYY-MM-DD.geojson

    Monthly community averages
        monthly_community_YYYY-MM.geojson

    Date lists
        TEMPOdaily_dates.json
        TEMPOmonthly_dates.json

All filenames exactly match what map.html and data_loader.js expect.

Usage:
    python process_tempo.py \
        --input tempo.nc \
        --communities ChicagoCommunityAreas.geojson \
        --output tempo_data \
        --resolution 0.01
"""
import os
import argparse
import json
from pathlib import Path
from collections import defaultdict

import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Polygon

import rioxarray as rxr
import xarray as xr


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def make_square(x, y, half_width):
    """Create a square polygon centered at (x, y)."""
    return Polygon([
        (x - half_width, y - half_width),
        (x + half_width, y - half_width),
        (x + half_width, y + half_width),
        (x - half_width, y + half_width),
        (x - half_width, y - half_width),
    ])


def detect_community_name_field(df):
    for field in ["community", "COMMUNITY", "community_name", "name"]:
        if field in df.columns:
            return field
    raise ValueError("Community name field not found.")


def write_geojson(features, file_path):
    file_path.parent.mkdir(parents=True, exist_ok=True)
    features.to_file(file_path, driver="GeoJSON")


# ---------------------------------------------------------------------------
# Main processing pipeline
# ---------------------------------------------------------------------------
def process_tempo(input_folder, communities_file, output_dir, half_width):

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)


    # -----------------------------------------------------------------------
    # 0. CLEAN AND CONDENSE DATA
    all_results_stored= []
    for filename in os.listdir(input_folder):
        file_path = os.path.join(input_folder, filename)
        all_results_stored += [file_path]
        if os.path.isfile(file_path):
            print(filename)

    # Create empty lists for the TEMPO NO2 and QC data:
    data_list_no2 = []
    data_list_qc = []
    data_list_clouds = []
    data_list_solarZ = []
    data_list_pbl = []

    # Loop through the result files:
    for result_file in sorted(all_results_stored):
        # For each file, add the NO2 or QC data from that file to the appropriate list:
        data_list_no2 += [xr.open_datatree(result_file)['product/vertical_column_troposphere']]
        data_list_qc += [xr.open_datatree(result_file)['product/main_data_quality_flag']]
        data_list_clouds += [xr.open_datatree(result_file)['support_data/eff_cloud_fraction']]
        data_list_solarZ += [xr.open_datatree(result_file)['geolocation/solar_zenith_angle']]
        data_list_pbl += [xr.open_datatree(result_file)['support_data/pbl_height']]

    # Concatenate each list into a Dataset along the time dimenion:
    tempo_data_no2 = xr.concat(data_list_no2,dim='time')
    tempo_data_qc = xr.concat(data_list_qc,dim='time')
    tempo_data_clouds = xr.concat(data_list_clouds,dim='time')
    tempo_data_solarZ = xr.concat(data_list_solarZ,dim='time')
    tempo_data_pbl = xr.concat(data_list_pbl,dim='time')

    # Merge both Datasets together:
    tempo_data = xr.merge([tempo_data_no2,tempo_data_qc,tempo_data_clouds, tempo_data_solarZ, tempo_data_pbl])

    # Clean the data (only high-quality pixels with low cloud fraction)
    filter_qa = tempo_data['main_data_quality_flag'] == 0
    filter_clouds = tempo_data['eff_cloud_fraction'] < 0.1 # conservative cloud 
    ds = tempo_data.where(filter_qa & filter_clouds).squeeze()

    # rename longitude and latitude to x and y for consistency with the rest of the code
    ds = ds.rename({"longitude": "x","latitude": "y"})

    # Examine the result:
    ds

    print("Loading TEMPO NetCDF...")
    # -----------------------------------------------------------------------
    # 1. GRID-CELL MODE (NO REGRID)
    # -----------------------------------------------------------------------

    # A) Hourly (split by date)
    print("Generating hourly grid-cell files...")
    ds_hourly = ds.resample(time="1h").mean()
    hourly_df = ds_hourly.to_dataframe().reset_index()
    hourly_df = hourly_df.dropna(subset=["vertical_column_troposphere"])

    # Convert points → square polygons
    hourly_gdf = gpd.GeoDataFrame(
        hourly_df,
        geometry=hourly_df.apply(lambda r: make_square(r["x"], r["y"], half_width), axis=1),
        crs="EPSG:4326"
    )

    # Split hourly into one file per date
    daily_dates = []
    for date, group in hourly_gdf.groupby(hourly_gdf["time"].dt.date):
        date_str = pd.Timestamp(date).strftime("%Y-%m-%d")
        daily_dates.append(date_str)

        file_path = out / f"{date_str}.geojson"
        write_geojson(group, file_path)
        print(file_path.name)

    # B) Daily grid-cell file (whole-day average)
    print("Generating daily grid-cell files...")
    ds_daily = ds.resample(time="1D").mean()
    daily_df = ds_daily.to_dataframe().reset_index()
    daily_df = daily_df.dropna(subset=["vertical_column_troposphere"])
    daily_gdf = gpd.GeoDataFrame(
        daily_df,
        geometry=daily_df.apply(lambda r: make_square(r["x"], r["y"], half_width), axis=1),
        crs="EPSG:4326"
    )

    for date, group in daily_gdf.groupby(daily_gdf["time"].dt.date):
        date_str = pd.Timestamp(date).strftime("%Y-%m-%d")
        file_path = out / f"day_{date_str}.geojson"
        write_geojson(group, file_path)
        print(file_path.name)

    # C) Monthly grid-cell files
    print("Generating monthly grid-cell files...")
    ds_monthly = ds.resample(time="1ME").mean()
    monthly_df = ds_monthly.to_dataframe().reset_index()
    monthly_df = monthly_df.dropna(subset=["vertical_column_troposphere"])
    monthly_gdf = gpd.GeoDataFrame(
        monthly_df,
        geometry=monthly_df.apply(lambda r: make_square(r["x"], r["y"], half_width), axis=1),
        crs="EPSG:4326"
    )

    monthly_dates = []
    for month_period, group in monthly_gdf.groupby(monthly_gdf["time"].dt.to_period("M")):
        month_str = str(month_period)  # "YYYY-MM"
        monthly_dates.append(month_str)
        file_path = out / f"month_{month_str}.geojson"
        write_geojson(group, file_path)
        print(file_path.name)

    # -----------------------------------------------------------------------
    # 2. COMMUNITY MODE (REGRID 0.01)
    # -----------------------------------------------------------------------
    print("Loading community polygons...")
    communities = gpd.read_file(communities_file)
    name_field = detect_community_name_field(communities)

    print("Regridding to 0.01° spacing for community aggregation...")
    # Build uniform grid
    x_min, x_max = float(ds_hourly.x.min()), float(ds_hourly.x.max())
    y_min, y_max = float(ds_hourly.y.min()), float(ds_hourly.y.max())

    spacing = half_width * 2  # i.e., 0.02-degree spacing for grid points
    new_x = np.arange(x_min, x_max + spacing / 2, spacing)
    new_y = np.arange(y_max, y_min - spacing / 2, -spacing)

    ds_regrid = ds_hourly.interp(x=new_x, y=new_y, method="nearest")
    regrid_df = ds_regrid.to_dataframe().reset_index()
    regrid_df = regrid_df.dropna(subset=["vertical_column_troposphere"])

    regrid_gdf = gpd.GeoDataFrame(
        regrid_df,
        geometry=gpd.points_from_xy(regrid_df["x"], regrid_df["y"]),
        crs="EPSG:4326"
    )

    regrid_gdf = regrid_gdf.to_crs(communities.crs)

    # DAILY COMMUNITY
    print("Generating daily community averages...")
    for date, group in regrid_gdf.groupby(regrid_gdf["time"].dt.date):
        date_str = pd.Timestamp(date).strftime("%Y-%m-%d")

        joined = gpd.sjoin(
            group,
            communities[[name_field, "geometry"]],
            how="left",
            predicate="within",
        )

        # Dissolve by community
        dissolved = joined.dissolve(
            by=name_field,
            aggfunc={"vertical_column_troposphere": "mean"}
        ).reset_index()

        file_path = out / f"day_community_{date_str}.geojson"
        write_geojson(dissolved, file_path)
        print(file_path.name)

    # MONTHLY COMMUNITY
    print("Generating monthly community averages...")
    for month_period, group in regrid_gdf.groupby(regrid_gdf["time"].dt.to_period("M")):
        month_str = str(month_period)

        joined = gpd.sjoin(
            group,
            communities[[name_field, "geometry"]],
            how="left",
            predicate="within",
        )

        dissolved = joined.dissolve(
            by=name_field,
            aggfunc={"vertical_column_troposphere": "mean"}
        ).reset_index()

        file_path = out / f"monthly_community_{month_str}.geojson"
        write_geojson(dissolved, file_path)
        print(file_path.name)

    # -----------------------------------------------------------------------
    # 3. DATE FILES
    # -----------------------------------------------------------------------
    print("Writing TEMPO date lists...")

    with open(out / "TEMPOdaily_dates.json", "w") as f:
        json.dump(sorted(daily_dates), f, indent=2)

    with open(out / "TEMPOmonthly_dates.json", "w") as f:
        json.dump(sorted(monthly_dates), f, indent=2)

    print("TEMPO processing complete")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unified TEMPO Processor")
    parser.add_argument("--input", required=True, help="TEMPO NetCDF folder")
    parser.add_argument("--communities", required=True, help="Chicago community areas GeoJSON")
    parser.add_argument("--output", required=True, help="Output folder")
    parser.add_argument("--resolution", type=float, default=0.01, help="Grid half-width for squares")
    args = parser.parse_args()

    process_tempo(
        args.input,
        args.communities,
        args.output,
        args.resolution
    )