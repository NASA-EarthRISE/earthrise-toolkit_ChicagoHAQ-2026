
import pandas as pd
import datetime as dt
from dateutil.relativedelta import relativedelta
import matplotlib.pyplot as plt
import geopandas as gpd
import matplotlib.colors as mcolors


#Define the path where your data is stored.
datapath = "/home/nlring/Documents/01_Research/larc-chicago-haq/datasets/"

#Define community shapefile path
community_shapefiles = (
                        "/home/nlring/Documents/01_Research/larc-chicago-haq/shapefiles/"
                        "ChicagoCommunityAreasBoundaries/geo_export_6383d95e-1e67-4fe2-8f45-534d73a53a92.shp"
                        )

#Defines custom color map for plots
colors = ['#dadaeb','#bcbddc',
          '#9e9ac8',
          '#807dba','#6a51a3','#54278f','#3f007d']
cmap = mcolors.LinearSegmentedColormap.from_list('purples_custom', colors)

#Load in community shapefile
chi_communities = gpd.read_file(community_shapefiles)
chi_communities = chi_communities.set_crs("EPSG:4326")

#Define filename for dataset here.
file_dir = datapath + "Open_Air_Chicago_Individual_Measurements_20260615.csv"

#Read in the full dataset for clarity sensors
cook_full = pd.read_csv(file_dir)

#Subset the data for our variables of interest
cook_clarity = cook_full[['sensor_name', 'latitude', 'longitude', 'time',
                            'no2ConcIndividual.value']]

cook_clarity["time"] = pd.to_datetime(cook_clarity["time"], format="%m/%d/%Y %I:%M:%S %p")
cook_clarity["month"] = cook_clarity["time"].dt.month
cook_clarity["year"] = cook_clarity["time"].dt.year
cook_clarity["month_year"] = pd.to_datetime(
    cook_clarity["month"].astype(str) + "-" + cook_clarity["year"].astype(str),
    format="%m-%Y"
)


#Convert to geopandas dataframe
cook_clarity["geometry"] = gpd.points_from_xy(
    x = cook_clarity["longitude"],
    y = cook_clarity["latitude"]
)

#Set coordinate reference system to match crs of data we downloaded earlier
cook_clarity = gpd.GeoDataFrame(cook_clarity).set_crs(chi_communities.crs)

#get % of missing per sensor
#note that this is just for the "no2ConcIndividual.value" variable in the dataframe
cook_clarity_na_count = (
    cook_clarity.groupby(["sensor_name", "longitude", "latitude",
                          "month", "month_year"])["no2ConcIndividual.value"]
    .apply(lambda x: 100 * x.isna().mean())
    .reset_index()
)


cook_clarity_na_count.rename(columns={"no2ConcIndividual.value": "percent_missing_no2"}, inplace=True)

# cook_clarity_na_count.to_csv("~/Documents/01_Research/larc-chicago-haq/datasets/missing-output.csv")

#Convert above dataframe to geopandas dataframe
#important to assign longitude and latitude for plotting
#This will need to be done for other statistics we calculate per station as well.
cook_clarity_na_count["geometry"] = gpd.points_from_xy(
    x=cook_clarity_na_count["longitude"],
    y=cook_clarity_na_count["latitude"]
)

#Set coordinate reference system to match crs of data we downloaded earlier
cook_clarity_na_count = gpd.GeoDataFrame(cook_clarity_na_count).set_crs(chi_communities.crs)


#--------------------------------------------------------------------------------------------------#
# PLOTTING
#--------------------------------------------------------------------------------------------------#

start_date = cook_clarity_na_count['month_year'].min()

delta = relativedelta(months=1)

fig, axes = plt.subplots(
    nrows=3, ncols=4,
    figsize=(20, 15)
)

for ax, _ in zip(axes.flatten(), range(1,13)):
    
    # Base Chicago boundary
    chi_communities.plot(color='white', edgecolor='black', ax=ax)
    
    # Filter to month
    monthly_data = cook_clarity_na_count[cook_clarity_na_count['month_year'] == start_date]
    
    if not monthly_data.empty:
        monthly_data.plot(ax=ax, column='percent_missing_no2', cmap=cmap,
                          vmin=cook_clarity_na_count['percent_missing_no2'].min(),
                          vmax=cook_clarity_na_count['percent_missing_no2'].max())
    
    # ax.set_title(calendar.month_name[month])
    # ax.axis('off')
  
    title_date = dt.date(start_date.year, start_date.month, start_date.day).strftime('%B %Y')
    ax.set_title(title_date, fontsize=12)
    ax.axis('off')
    start_date += delta

# Shared colorbar
sm = plt.cm.ScalarMappable(
    cmap='BuPu',
    norm=plt.Normalize(
        vmin=cook_clarity_na_count['percent_missing_no2'].min(),
        vmax=cook_clarity_na_count['percent_missing_no2'].max()
    )
)
fig.colorbar(sm, ax=axes, shrink=0.5, label='%')

plt.suptitle('% Data Missing - Chicago', fontsize=16, y=1.02)
plt.tight_layout()
plt.savefig("percent-missing-values-per-station.png", dpi=300)

