import xarray as xr
import pandas as pd
import numpy as np

#This file outputs two datasets, one is an unaggregated combination of 
#TEMPO, MERRA2, and Clarity sensors. It has mismatched 

#------------------------------------------------------------------------------------#
#VARS TO CHANGE
#------------------------------------------------------------------------------------#
# Toggle whether to output files. 
write_files = True 

datapath = "/home/nlring/Documents/01_Research/larc-chicago-haq/datasets/"

#Define the path where the tempo files are stored.
tempo_path = datapath + "tempo.nc"
tempo_addvar_path = datapath + "tempo_addVar.nc"

#Define merra path
merra_path = datapath + "merra2_subset.nc"

#Define clarity path
clarity_path = datapath + "Open_Air_Chicago_Individual_Measurements_20260615.csv"

#define where to save unaggregated dataset
unagg_save_name = datapath + "fulldat-unaggregated.csv"

#Define where to save pixel-masked dataset
masked_save_name = datapath + "fulldat-unaggregated-pixelmask.csv"

#Define where to save the pixel-masked, hourly-averaged timeseries
hr_ts_save_name = datapath + "fulldat-hourly-timeseries.csv"

#------------------------------------------------------------------------------------#

#------------------------------------------------------------------------------------#

# Change some of the default xarray settings
xr.set_options(keep_attrs=True, display_expand_data=False)

# EPSG to be used when setting coordinate reference systems
epsg = 4326 

# Function used for coercing clarity lat/lon to match the 0.2 x 0.2deg grid of TEMPO
# Note: I included the bias term (0.01) to force the lat/lon to match TEMPO lat/lon
def round_002(x):
    out = 0.02*np.floor(x/0.02) + 0.01
    return np.round(out, 2)

def round_002_vectorized(arr):
    return xr.apply_ufunc(round_002, arr, vectorize=True)

def resample_merra2_to_tempo(input_array, merra_path, interp = "nearest"):
    #this function was repurposed and edited from:
    # https://github.com/nasa/ASDC_Data_and_User_Services/blob/main/TEMPO/D2P5_exercise_surface_level_AQ_complete.ipynb

    # if isinstance(input_array, xr.Dataset):
    #     try:
    #         input_array = xr.Dataset({input_array.name: input_array})
    #     except Exception:
    #         print("ERROR: input data type can not be converted to a dataset.")

    # Define the maximum and minimum dimensions of the input data to get the extent of interest:
    min_lat = (
        input_array.latitude.values.min() - 1 # 0.25
    )  # get the minimum latitude from the input dataset, subtract 0.25 for a buffer
    max_lat = (
        input_array.latitude.values.max() + 1 # 0.25
    )  # get the maximum latitude from the input dataset, add 0.25 for a buffer
    min_lon = (
        input_array.longitude.values.min() - 1 # 0.25
    )  # get the minimum longitude from the input dataset, subtract 0.25 for a buffer
    max_lon = (
        input_array.longitude.values.max() + 1 # 0.25 
    )  # get the maximum longitude from the input dataset, add 0.25 for a buffer
    min_time = input_array.datetime.values.min() - np.timedelta64(
        1, "h"
    )  # get the minimum time from the input dataset, subtract 1 hour for a buffer
    max_time = input_array.datetime.values.max() + np.timedelta64(
        1, "h"
    )  # get the maximum time from the input dataset, add 1 hour for a buffer

    merra_slice_u_2m = xr.open_dataset(merra_path).loc[
        {
            "time": slice(min_time, max_time),
            "lat": slice(min_lat, max_lat),
            "lon": slice(min_lon, max_lon),
        }
    ]["U2M"]  # access column NO2 data for the time and location
    merra_slice_v_2m = xr.open_dataset(merra_path).loc[
        {
            "time": slice(min_time, max_time),
            "lat": slice(min_lat, max_lat),
            "lon": slice(min_lon, max_lon),
        }
    ]["V2M"]  # access column NO2 data for the time and location
    merra_slice_u_10m = xr.open_dataset(merra_path).loc[
        {
            "time": slice(min_time, max_time),
            "lat": slice(min_lat, max_lat),
            "lon": slice(min_lon, max_lon),
        }
    ]["U10M"]  # access column NO2 data for the time and location
    merra_slice_v_10m = xr.open_dataset(merra_path).loc[
        {
            "time": slice(min_time, max_time),
            "lat": slice(min_lat, max_lat),
            "lon": slice(min_lon, max_lon),
        }
    ]["V10M"]  # access column NO2 data for the time and location


    merra_rename_u_2m = merra_slice_u_2m.rename(
        {"lat": "latitude", "lon": "longitude", "time":"datetime"}
    )  # rename the data dimensions to match the input file dimensions
    merra_rename_v_2m = merra_slice_v_2m.rename(
        {"lat": "latitude", "lon": "longitude", "time":"datetime"}
    )  # rename the data dimensions to match the input file dimensions
    merra_rename_u_10m = merra_slice_u_10m.rename(
        {"lat": "latitude", "lon": "longitude", "time":"datetime"}
    )  # rename the data dimensions to match the input file dimensions
    merra_rename_v_10m = merra_slice_v_10m.rename(
        {"lat": "latitude", "lon": "longitude", "time":"datetime"}
    )  # rename the data dimensions to match the input file dimensions

    merra_interp_u_2m = merra_rename_u_2m.interp_like(
        input_array, method=interp
    )  # interpolate the GEOS-CF grid to the input dataset grid
    merra_interp_v_2m = merra_rename_v_2m.interp_like(
        input_array, method=interp
    )  # interpolate the GEOS-CF grid to the input dataset grid
    merra_interp_u_10m = merra_rename_u_10m.interp_like(
        input_array, method=interp
    )  # interpolate the GEOS-CF grid to the input dataset grid
    merra_interp_v_10m = merra_rename_v_10m.interp_like(
        input_array, method=interp
    )  # interpolate the GEOS-CF grid to the input dataset grid

    # Add the data into the output:
    output_array = input_array
    output_array["U2M"] = merra_interp_u_2m
    output_array["V2M"] = merra_interp_v_2m
    output_array["U10M"] = merra_interp_u_10m
    output_array["V10M"] = merra_interp_v_10m

    # Return the GEOS-CF Data as well:
    merra_wind = xr.merge([merra_interp_u_2m, merra_interp_v_2m, merra_interp_u_10m, merra_interp_v_10m])

    # Return the outputs:
    return output_array, merra_wind 

# Use xarray to load tempo data
tempo_raster = xr.open_dataset(tempo_path)
tempo_raster = tempo_raster.rename({"vertical_column_troposphere":"column_no2"})
tempo_raster = tempo_raster.rename({"time": "datetime"})

#load additional variables. This can be removed in future but was necessary here
tempo_addvar = xr.open_dataset(tempo_addvar_path)

tempo_pbl_rast = tempo_addvar.pbl_height
tempo_pbl_rast = tempo_pbl_rast.rename({"time": "datetime"})

tempo_solar_zenith = tempo_addvar.solar_zenith_angle
tempo_solar_zenith = tempo_solar_zenith.rename({"time": "datetime"})

tempo_raster = tempo_raster.assign_coords(
    latitude = round_002_vectorized(tempo_raster.latitude.astype('float64')),
    longitude = round_002_vectorized(tempo_raster.longitude.astype('float64'))
)
tempo_pbl_rast = tempo_pbl_rast.assign_coords(
    latitude = round_002_vectorized(tempo_pbl_rast.latitude.astype('float64')),
    longitude = round_002_vectorized(tempo_pbl_rast.longitude.astype('float64'))
)
tempo_solar_zenith = tempo_solar_zenith.assign_coords(
    latitude = round_002_vectorized(tempo_solar_zenith.latitude.astype('float64')),
    longitude = round_002_vectorized(tempo_solar_zenith.longitude.astype('float64'))
)

tempo_subset_rast = xr.merge([tempo_raster, tempo_pbl_rast, tempo_solar_zenith], join="outer", compat="no_conflicts")

print("TEMPO data loaded and merged.")

# Path for MERRA2

tempo_merra, merra_wind = resample_merra2_to_tempo(tempo_subset_rast, merra_path)

tempo_merra = tempo_merra.assign_coords(
    latitude = round_002_vectorized(tempo_merra.latitude.astype('float64')),
    longitude = round_002_vectorized(tempo_merra.longitude.astype('float64'))
)

tm_subset = tempo_merra.to_dataframe().reset_index()
tm_subset['hour'] = tm_subset['datetime'].dt.hour
tm_subset['doy'] = tm_subset['datetime'].dt.dayofyear
tm_subset['month'] = tm_subset['datetime'].dt.month
tm_subset['week'] = tm_subset['datetime'].dt.isocalendar().week
tm_subset["year"] = tm_subset['datetime'].dt.year
tm_subset["datetime"] = (
    pd.to_datetime(tm_subset["datetime"], errors="coerce")
    .dt.floor("s")
)

print("MERRA2 loaded.")

# Load clarity data .csv
clarity_full_dat = pd.read_csv(clarity_path)

print("Clarity data loaded.")

# Subset the clarity sensor data for our variables of interest
# Reformat the datetime variable, and add other time columns to possibly be used later
clarity_subset = clarity_full_dat[['datasourceid', 'sensor_name', 
                                   'latitude', 'longitude', 'time',
                            'no2ConcIndividual.value']]
clarity_subset['datetime'] = (
    pd.to_datetime(clarity_subset["time"], format="%m/%d/%Y %I:%M:%S %p", errors="coerce")
    .dt.floor("s")
)
clarity_subset = clarity_subset.drop('time', axis=1)
clarity_subset['doy'] = clarity_subset['datetime'].dt.dayofyear
clarity_subset['hour'] = clarity_subset['datetime'].dt.hour
clarity_subset["year"] = clarity_subset['datetime'].dt.year
clarity_subset["week"] = clarity_subset['datetime'].dt.isocalendar().week
clarity_subset['month'] = clarity_subset['datetime'].dt.month
clarity_subset['latitude'] = round_002(clarity_subset['latitude'].astype('float64'))
clarity_subset['longitude'] = round_002(clarity_subset['longitude'].astype('float64'))

sensors_per_pixel = (
    clarity_subset.groupby(['latitude','longitude'])
    .agg(sensor_count=('datasourceid', 'nunique'))
    )

clarity_subset = clarity_subset.merge(sensors_per_pixel, how='left', on=['latitude','longitude'])


start_date = tm_subset['datetime'].min()
end_date = tm_subset['datetime'].max()

cd_subset = clarity_subset[['year', 'month','week', 'doy', 'hour', 'datetime', 'latitude', 'longitude', 'no2ConcIndividual.value']]

tempo_no2 = tm_subset[['column_no2','pbl_height','solar_zenith_angle',
                            'U2M', 'V2M', 'U10M', 'V10M',
                           'datetime','latitude','longitude',
                           'year','month','week','doy','hour']]

combined = cd_subset.merge(tempo_no2, 
                            on=['datetime', 'year', 'month','week', 'doy', 'hour', 'latitude','longitude'],
                            how='outer',
                            validate='many_to_many')

combined = combined.reset_index().drop('index',axis=1)
combined = combined.drop_duplicates()
combined['sfc_no2'] = combined['no2ConcIndividual.value']
combined = combined.drop('no2ConcIndividual.value', axis=1)

print("Unaggregated data merged.")


#This outputs the full, unaggregated dataframe with mismatched temporal resolutions
if write_files == True:
    print("Saving file...")
    combined.to_csv(unagg_save_name)

#Here we are getting the mask to remove clarity values when there are no tempo values
tempo_na_mask = (
    combined.set_index('datetime')
    .groupby([pd.Grouper('datetime', freq='1h'), 'latitude', 'longitude'])
    .agg(
        col_no2_mean=('column_no2', 'mean'),
        hour=('hour', 'first'),
        doy=('doy', 'first'),
        week=('week','first'),
        month=('month', 'first'),
        year=('year', 'first')
    )
    .reset_index()
    .drop(['datetime'], axis=1)
)

tempo_na_mask['rm_if_true'] = False
tempo_na_mask.loc[tempo_na_mask['col_no2_mean'].isna(), 'rm_if_true'] = True

#Dropping values using the mask
combined_drop = combined.merge(tempo_na_mask, how="outer", on=['year','month','week','doy','hour','latitude','longitude'])

combined_drop['sfc_no2'] = combined_drop['sfc_no2'].mask(combined_drop['rm_if_true'])

print("TEMPO NA mask completed.")

#output the pixelmasked .csv
if write_files==True:
    print("Saving...")
    combined_drop.to_csv(masked_save_name)

hourly_dat = (
    combined_drop.set_index('datetime')
    .groupby([pd.Grouper('datetime', freq='1h'), 'latitude', 'longitude'])
    .agg( 
        col_no2_mean=('column_no2', 'mean'),
        col_no2_median=('column_no2', 'median'),
        col_no2_var=('column_no2', 'var'),
        col_no2_sd=('column_no2', 'std'),
        sfc_no2_mean=('sfc_no2', 'mean'),
        sfc_no2_median=('sfc_no2', 'median'),
        sfc_no2_var=('sfc_no2', 'var'),
        sfc_no2_sd=('sfc_no2', 'std'),
        pbl_mean=('pbl_height', 'mean'), 
        pbl_median=('pbl_height', 'median'),
        solar_zenith_mean=('solar_zenith_angle', 'mean'), 
        solar_zenith_median=('solar_zenith_angle', 'median'),
        u2m_mean=('U2M','mean'),
        u2m_median=('U2M','median'),
        v2m_mean=('V2M','mean'),
        v2m_median=('V2M','median'),
        u10m_mean=('U10M','mean'),
        u10m_median=('U10M','median'),
        v10m_mean=('V10M','mean'),
        v10m_median=('V10M','median')
        ).reset_index()
)

if write_files==True:
    print("Saving...")
    hourly_dat.to_csv(hr_ts_save_name)

