import xarray as xr
# import matplotlib as plt
from matplotlib import pyplot as plt
import pandas as pd
from math import sqrt
import seaborn as sns
import numpy as np
from scipy.stats import kurtosis, norm

from sklearn import linear_model
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, root_mean_squared_error 
from sklearn.preprocessing import StandardScaler

import warnings
warnings.filterwarnings('ignore')

# Change some of the default xarray settings
xr.set_options(keep_attrs=True, display_expand_data=False)

def rmse(x,y):
    out = sqrt(mean_squared_error(x,y))
    return out


datapath = "/home/nlring/Documents/01_Research/larc-chicago-haq/datasets/"

model_vals = pd.read_csv(datapath+"seasonal-weekday-model-values.csv")

estimates_df = pd.read_csv(datapath+"seasonal-dayofweek-no2-estimates.csv")

season_order = sorted(model_vals['season'].dropna().unique())

season_map = {

    12: 'Winter',
    1: 'Winter',
    2: 'Winter',
    3: 'Spring',
    4: 'Spring',
    5: 'Spring',
    6: 'Summer',
    7: 'Summer',
    8: 'Summer',
    9: 'Fall',
    10: 'Fall',
    11: 'Fall',
}

weekday_map = {
    0: 'Monday',
    1: 'Tuesday',
    2: 'Wednesday',
    3: 'Thursday',
    4: 'Friday',
    5: 'Saturday',
    6: 'Sunday'
}

seasonal_weekday = pd.read_csv(datapath+"seasonal-dayofweek-no2-estimates.csv")
seasonal_weekday['datetime'] = pd.to_datetime(seasonal_weekday['datetime'], errors='coerce')
seasonal_weekday['hour'] = seasonal_weekday['datetime'].dt.hour
seasonal_weekday['weekday'] = seasonal_weekday['datetime'].dt.weekday
seasonal_weekday['season'] = seasonal_weekday['month'].map(season_map)
subset = seasonal_weekday[['datetime','latitude','longitude','residual']].set_index(['datetime','latitude','longitude'])

estimate_grouped = seasonal_weekday.groupby(['hour','weekday']).agg(
    est_no2_mean = ('no2_estimate', 'mean')
)

def F_pixel_stats(dat):
   y_true = dat.sfc_no2_mean
   y_pred = dat.no2_estimate
   col_no2 = dat.col_no2_mean
   sfc_no2 = dat.sfc_no2_mean
   bias = (y_pred-y_true).mean()
   rmse = sqrt(mean_squared_error(y_true, y_pred))
   r2 = r2_score(y_true, y_pred)
   # covar = np.cov(y_true, y_pred, ddof=0)
   corr_coef = np.corrcoef(y_true, y_pred, rowvar=False)[0,1]
   point_pixel_corr = np.corrcoef(sfc_no2, col_no2)[0,1]
   out = pd.Series({'r2': r2,
                    'bias': bias,
                    'rmse':rmse,
                    'corr_coef': corr_coef,
                    'pnt_px_corr': point_pixel_corr})
   return out




pixel_stats_wide = (
    seasonal_weekday.groupby(['latitude','longitude','season','split'])
    .apply(F_pixel_stats)
    .reset_index())

pixel_stats_long = (
    seasonal_weekday.groupby(['latitude','longitude','season','split'])
    .apply(F_pixel_stats)
    .melt(ignore_index=False)
    .reset_index())

pixel_stats_wide_no_split = (
    seasonal_weekday.groupby(['latitude','longitude','season'])
    .apply(F_pixel_stats)
    .reset_index())

pixel_stats_long_no_split = (
    seasonal_weekday.groupby(['latitude','longitude','season'])
    .apply(F_pixel_stats)
    .melt(ignore_index=False)
    .reset_index())


##############################################################################################
# PLOT R2 and RMSE BY SEASON & WEEKDAY
##############################################################################################

fig, axes = plt.subplots(
    nrows=1,
    ncols=len(season_order),
    figsize=(4 * len(season_order), 4),
    sharey=True,
)

if len(season_order) == 1:
    axes = [axes]

for ax, season_name in zip(axes, season_order):
    season_data = model_vals[model_vals['season'] == season_name]
    ax.plot(season_data['weekday'], season_data['train_r2'], marker='o', color='darkblue', label='train')
    ax.plot(season_data['weekday'], season_data['test_r2'], marker='o', color='darkred', label='test')
    ax.set_xticks(season_data['weekday'])
    ax.set_xticklabels(season_data['weekday'].map(weekday_map), rotation=45, ha='right')
    ax.set_xlabel('weekday')
    ax.set_ylabel('R$^2$')
    ax.set_title(f'Season: {season_name}')
    ax.grid(True, alpha=0.3)

handles, labels = axes[0].get_legend_handles_labels()
fig.legend(handles, labels, loc='upper center', bbox_to_anchor=(0.5, 0.02), ncol=2)
fig.suptitle('Model R$^2$ by Season and Weekday')
plt.tight_layout(rect=(0, 0.05, 1, 1))
plt.savefig('r2-seasonal-weekday.png')
#plt.show()


fig, axes = plt.subplots(
    nrows=1,
    ncols=len(season_order),
    figsize=(4 * len(season_order), 4),
    sharey=True,
)

if len(season_order) == 1:
    axes = [axes]

for ax, season_name in zip(axes, season_order):
    season_data = model_vals[model_vals['season'] == season_name]
    ax.plot(season_data['weekday'], season_data['train_rmse'], marker='o', color='darkblue', label='train')
    ax.plot(season_data['weekday'], season_data['test_rmse'], marker='o', color='darkred', label='test')
    ax.set_xticks(season_data['weekday'])
    ax.set_xticklabels(season_data['weekday'].map(weekday_map), rotation=45, ha='right')
    ax.set_xlabel('weekday')
    ax.set_ylabel('RMSE')
    ax.set_title(f'{season_name}')
    ax.grid(True, alpha=0.3)

handles, labels = axes[0].get_legend_handles_labels()
fig.legend(handles, labels, loc='upper center', bbox_to_anchor=(0.5, 0.02), ncol=2)
fig.suptitle('Model RMSE by Season and Weekday')
plt.tight_layout(rect=(0, 0.05, 1, 1))
plt.savefig('rmse-seasonal-weekday.png')
#plt.show()

##############################################################################################
# PLOT BOXPLOT OF Open Air, Tempo, and Fused
##############################################################################################

max_points_per_box = 10000

rng = np.random.default_rng(41)

estimates_plot = (
    estimates_df[['month','weekday','sfc_no2_mean', 'no2_estimate','col_no2_mean']]
    .dropna(subset=['sfc_no2_mean', 'no2_estimate'])
    .copy()
)
estimates_plot['month'] = estimates_plot['month'].astype(int)
estimates_plot['weekday'] = estimates_plot['weekday'].astype(int)

weekday_labels = []
weekday_names = []
actual_by_weekday = []
estimated_by_weekday = []
col_by_weekday = []
col_medians = []

for weekday, group in estimates_plot.groupby('weekday', sort=True):
    weekday_num = int(weekday)
    weekday_labels.append(weekday_num)
    weekday_names.append(weekday_map.get(weekday_num, weekday_num))

    actual_values = group['sfc_no2_mean'].to_numpy(dtype=float)
    estimated_values = group['no2_estimate'].to_numpy(dtype=float)
    col_values = group['col_no2_mean'].to_numpy(dtype=float)

    if len(actual_values) > max_points_per_box:
        sample_idx = rng.choice(len(actual_values), size=max_points_per_box, replace=False)
        actual_values = actual_values[sample_idx]
        estimated_values = estimated_values[sample_idx]
        col_values = col_values[sample_idx]

    actual_by_weekday.append(actual_values)
    estimated_by_weekday.append(estimated_values)
    col_by_weekday.append(col_values)
    col_medians.append(np.nanmedian(col_values))

fig, ax = plt.subplots(figsize=(12, 7))
ax2 = ax.twinx()

positions = np.arange(len(weekday_labels))
positions_actual = positions - 0.22
positions_estimated = positions
positions_col = positions + 0.22

viridis = plt.cm.viridis
colors = viridis([0.15, 0.45, 0.80])

ax.boxplot(
    actual_by_weekday,
    positions=positions_actual,
    widths=0.18,
    patch_artist=True,
    showfliers=False,
    boxprops=dict(facecolor=colors[0], alpha=0.85),
    medianprops=dict(color=viridis(0.10)),
    whiskerprops=dict(color=viridis(0.10)),
    capprops=dict(color=viridis(0.10)),
)
ax.boxplot(
    estimated_by_weekday,
    positions=positions_estimated,
    widths=0.18,
    patch_artist=True,
    showfliers=False,
    boxprops=dict(facecolor=colors[1], alpha=0.85),
    medianprops=dict(color=viridis(0.35)),
    whiskerprops=dict(color=viridis(0.35)),
    capprops=dict(color=viridis(0.35)),
)
ax2.boxplot(
    col_by_weekday,
    positions=positions_col,
    widths=0.18,
    patch_artist=True,
    showfliers=False,
    boxprops=dict(facecolor=colors[2], alpha=0.85),
    medianprops=dict(color=viridis(0.65)),
    whiskerprops=dict(color=viridis(0.65)),
    capprops=dict(color=viridis(0.65)),
)

# for pos, col_median in zip(positions, col_medians):
#     ax2.plot(
#         [pos - 0.16, pos + 0.16],
#         [col_median, col_median],
#         color=viridis(0.65),
#         linestyle='--',
#         linewidth=1.8,
#         alpha=0.95,
#     )
y2_min = -0.25e16
y2_max = 2e16
y2_step = 0.25e16
ax2_ticks = np.arange(y2_min, y2_max + y2_step, y2_step)

ax.set_zorder(ax2.get_zorder() + 1)
ax.patch.set_visible(False)

ax.set_xlim(min(positions) - 0.5, max(positions) + 0.5)
ax.set_xticks(positions)
ax.set_xticklabels(weekday_names)
ax.set_ylim(0, 30)
ax.set_xlabel('')
ax.set_ylabel('NO2 (ppb)')
ax.set_title('')
ax.grid(True, axis='y', alpha=0.3)

ax2.set_axisbelow(True)
ax2.set_ylim(y2_min, y2_max)
ax2.set_yticks(ax2_ticks)
ax2.set_ylabel('NO2 (molecules/m$^2$)')
ax2.grid(True, axis='y', alpha=0.3, linestyle='--')

actual_patch = plt.Line2D([0], [0], color=viridis(0.10), lw=4, label='Clarity NO$_2$')
estimated_patch = plt.Line2D([0], [0], color=viridis(0.35), lw=4, label='Estimated NO$_2$')
col_patch = plt.Line2D([0], [0], color=viridis(0.65), lw=4, label='TEMPO NO$_2$')
ax.legend(handles=[actual_patch, estimated_patch, col_patch])

# ax.yaxis.label.set_color('white')
# ax.xaxis.label.set_color('white')
# ax.tick_params(axis='y', colors='white')
# ax.tick_params(axis='x', colors='white')

# ax2.yaxis.label.set_color('white')
# ax2.tick_params(axis='y', colors='white')

plt.tight_layout()
plt.savefig('clarity-tempo-fused-boxplots.png',dpi=300)

#plt.show()

##############################################################################################
# Seasonal Residual Average
##############################################################################################

season_order = ['Winter', 'Spring', 'Summer', 'Fall']
seasonal_maps = []

for season in season_order:
    if season not in seasonal_weekday['season'].dropna().unique():
        continue

    season_subset = seasonal_weekday.loc[seasonal_weekday['season'] == season, ['datetime', 'latitude', 'longitude', 'residual']]
    season_subset = season_subset.set_index(['datetime', 'latitude', 'longitude'])
    season_rast = season_subset.to_xarray()
    seasonal_maps.append((season, season_rast['residual'].mean(dim='datetime', skipna=True)))

all_residuals = [mean_map.values.ravel() for _, mean_map in seasonal_maps]
max_abs = max(abs(np.nanmax(values)) for values in all_residuals if values.size > 0)
shared_vmax = max_abs
shared_vmin = -max_abs

fig, axes = plt.subplots(nrows=1, ncols=3, figsize=(15, 5), sharex=True, sharey=True)
axes = axes.flatten()

for ax, (season, mean_map) in zip(axes, seasonal_maps):
    mean_map.plot(
        x='longitude',
        y='latitude',
        cmap='RdBu_r',
        ax=ax,
        add_colorbar=True,
        vmin=shared_vmin,
        vmax=shared_vmax,
        cbar_kwargs={'label': 'Residual'}
    )
    ax.set_title(season)
    ax.set_xlabel('Longitude')
    ax.set_ylabel('Latitude')

for ax in axes[len(seasonal_maps):]:
    ax.set_visible(False)

fig.suptitle('Seasonal Averages of Residual (Estimated NO2 - Near-Surface NO2) ')
plt.tight_layout(rect=[0, 0, 1, 0.97])
plt.savefig('seasonal-weekday-spatial-residuals.png')


##############################################################################################
# Seasonal AVG R^2
##############################################################################################

seasonal_maps = []
splits = ['test','train']

for split in splits:
    seasonal_maps = []
    for season in season_order:
        season_subset = pixel_stats_long.loc[
            (pixel_stats_long['season'] == season) & (pixel_stats_long['variable'] == 'r2') & (pixel_stats_long['split']==split),
            ['latitude', 'longitude', 'value']
        ]
        if season_subset.empty:
            continue

        season_rast = season_subset.set_index(['latitude', 'longitude']).to_xarray()
        seasonal_maps.append((season, season_rast['value']))

    fig, axes = plt.subplots(nrows=1, ncols=3, figsize=(15, 5), sharex=True, sharey=True)
    axes = axes.flatten()
    mappable = None

    for ax, (season, mean_map) in zip(axes, seasonal_maps):
        mappable = mean_map.plot(
            x='longitude',
            y='latitude',
            cmap='RdBu',
            ax=ax,
            add_colorbar=False,
            vmin=-1,
            vmax=1
        )
        ax.set_box_aspect(1)
        ax.set_title(season)
        ax.set_xlabel('Longitude')
        ax.set_ylabel('Latitude')

    for ax in axes[len(seasonal_maps):]:
        ax.set_visible(False)

    # Reserve space at right for a single shared colorbar
    plt.tight_layout(rect=[0, 0, 0.92, 0.97])

    if mappable is not None:
        cax = fig.add_axes([0.94, 0.15, 0.015, 0.7])
        fig.colorbar(mappable, cax=cax, label='R$^2$')

    fig.suptitle('Per Pixel R$^2$ - '+split+' data')
    plt.savefig('seasonal-r2-spatial-maps-'+split+'-data.png')


seasonal_residuals = []

for season in season_order:
    if season not in pixel_stats_wide['season'].dropna().unique():
        continue

    season_values = pixel_stats_wide.loc[pixel_stats_wide['season'] == season, 'r2'].dropna()
    if not season_values.empty:
        seasonal_residuals.append((season, season_values))

fig, ax = plt.subplots(figsize=(8, 5))
viridis_colors = plt.cm.viridis(np.linspace(0.15, 0.85, len(seasonal_residuals)))

for i, (season, values) in enumerate(seasonal_residuals):
    sns.kdeplot(
        values,
        ax=ax,
        label=season,
        fill=False,
        alpha=0.75,
        linewidth=2,
        color=viridis_colors[i]
    )

    kurt = kurtosis(values, fisher=False, bias=False)
    ax.text(
        0.98,
        0.92 - 0.06 * i,
        f'{season}: kurtosis = {kurt:.2f}',
        transform=ax.transAxes,
        ha='right',
        va='top',
        fontsize=9,
    )

ax.set_title('Kernel Density of Per-Pixel Pred-to-Actual R$^2$ by Season')
ax.set_xlabel('R$^2$')
ax.set_ylabel('Density')
ax.legend()
plt.tight_layout()
plt.savefig('kde-per-pixel-r2-seasonal.png')

##############################################################################################
# Seasonal AVG Bias
##############################################################################################

for split in splits:
    seasonal_maps = []
    for season in season_order:
        season_subset = pixel_stats_long.loc[
            (pixel_stats_long['season'] == season) & (pixel_stats_long['variable'] == 'bias') & (pixel_stats_long['split']==split),
            ['latitude', 'longitude', 'value']
        ]
        if season_subset.empty:
            continue

        season_rast = season_subset.set_index(['latitude', 'longitude']).to_xarray()
        seasonal_maps.append((season, season_rast['value']))

    fig, axes = plt.subplots(nrows=1, ncols=3, figsize=(15, 5), sharex=True, sharey=True)
    axes = axes.flatten()
    mappable = None

    for ax, (season, mean_map) in zip(axes, seasonal_maps):
        mappable = mean_map.plot(
            x='longitude',
            y='latitude',
            cmap='RdBu',
            ax=ax,
            add_colorbar=False,
            # vmin=-20,
            # vmax=10
        )
        ax.set_box_aspect(1)
        ax.set_title(season)
        ax.set_xlabel('Longitude')
        ax.set_ylabel('Latitude')

    for ax in axes[len(seasonal_maps):]:
        ax.set_visible(False)

    # Reserve space at right for a single shared colorbar
    plt.tight_layout(rect=[0, 0, 0.92, 0.97])

    if mappable is not None:
        cax = fig.add_axes([0.94, 0.15, 0.015, 0.7])
        fig.colorbar(mappable, cax=cax, label='Bias')

    fig.suptitle('Per Pixel Bias - '+split+' data')
    plt.savefig('seasonal-bias-spatial-maps-'+split+'-data.png')


seasonal_residuals = []

for season in season_order:
    if season not in pixel_stats_wide['season'].dropna().unique():
        continue

    season_values = pixel_stats_wide.loc[pixel_stats_wide['season'] == season, 'bias'].dropna()
    if not season_values.empty:
        seasonal_residuals.append((season, season_values))

fig, ax = plt.subplots(figsize=(8, 5))

for i, (season, values) in enumerate(seasonal_residuals):
    sns.kdeplot(
        values,
        ax=ax,
        label=season,
        fill=False,
        alpha=0.75,
        linewidth=2
    )

    kurt = kurtosis(values, fisher=False, bias=False)
    ax.text(
        0.98,
        0.92 - 0.06 * i,
        f'{season}: kurtosis = {kurt:.2f}',
        transform=ax.transAxes,
        ha='right',
        va='top',
        fontsize=9,
    )

ax.set_title('Kernel Density of Per-Pixel Pred-to-Actual Bias by Season')
ax.set_xlabel('Bias')
ax.set_ylabel('Density')
ax.legend()
plt.tight_layout()
plt.savefig('kde-per-pixel-bias-seasonal.png')


##############################################################################################
# Seasonal Correlation between avg ground sensor and pixel val
##############################################################################################

seasonal_maps = []
for season in season_order:
    season_subset = pixel_stats_long_no_split.loc[
        (pixel_stats_long_no_split['season'] == season)
        & (pixel_stats_long_no_split['variable'] == 'pnt_px_corr'),
        ['latitude', 'longitude', 'value']
    ]
    if season_subset.empty:
        continue

    season_rast = season_subset.set_index(['latitude', 'longitude']).to_xarray()
    seasonal_maps.append((season, season_rast['value']))

fig, axes = plt.subplots(
    nrows=1,
    ncols=len(season_order),
    figsize=(5 * len(season_order), 5),
    sharex=True,
    sharey=True
)
axes = np.atleast_1d(axes).flatten()
mappable = None

for ax, (season, mean_map) in zip(axes, seasonal_maps):
    mappable = mean_map.plot(
        x='longitude',
        y='latitude',
        cmap='viridis',
        ax=ax,
        add_colorbar=False,
    )
    ax.set_box_aspect(1)
    ax.set_title(season)
    ax.set_xlabel('Longitude')
    ax.set_ylabel('Latitude')

for ax in axes[len(seasonal_maps):]:
    ax.set_visible(False)

plt.tight_layout(rect=[0, 0, 0.92, 0.97])

if mappable is not None:
    cax = fig.add_axes([0.94, 0.15, 0.015, 0.7])
    fig.colorbar(mappable, cax=cax, label='Correlation Coefficient')

fig.suptitle('Point-Pixel Correlation')
plt.savefig('seasonal-pt-pix-correlation-spatial-maps.png')

seasonal_residuals = []
for season in season_order:
    season_values = pixel_stats_wide_no_split.loc[
        pixel_stats_wide_no_split['season'] == season,
        'pnt_px_corr'
    ].dropna()
    if not season_values.empty:
        seasonal_residuals.append((season, season_values))

fig, ax = plt.subplots(figsize=(8, 5))

for i, (season, values) in enumerate(seasonal_residuals):
    sns.kdeplot(
        values,
        ax=ax,
        label=season,
        fill=False,
        alpha=0.75,
        linewidth=2
    )

    kurt = kurtosis(values, fisher=False, bias=False)
    ax.text(
        0.98,
        0.92 - 0.06 * i,
        f'{season}: kurtosis = {kurt:.2f}',
        transform=ax.transAxes,
        ha='right',
        va='top',
        fontsize=9,
    )

ax.set_title('Kernel Density of Per-Pixel Point-Pixel Correlation by Season')
ax.set_xlabel('Correlation Coefficient')
ax.set_ylabel('Density')
ax.legend()
plt.tight_layout()
plt.savefig('kde-pt-pixel-correlations-seasonal.png')


##############################################################################################
# NO2 Conc Heatmap - Fused Data
##############################################################################################

# Subset data
subset = estimate_grouped.reset_index().copy()
subset['hour'] = subset['hour'] - 5

# Pivot to a weekday-by-hour matrix
heatmap_data = (
    subset.pivot(index="weekday", columns="hour", values="est_no2_mean")
    .reindex(index=range(7), columns=range(0, 24))
)

# Plot a heatmap with time of day on the x-axis and weekday on the y-axis
fig, ax = plt.subplots(figsize=(8, 4))
sns.heatmap(
    heatmap_data,
    cmap="viridis",
    ax=ax,
    cbar_kws={"label": "NO2 concentration (ppb)"},
    xticklabels=range(0, 24),
    yticklabels=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
)
ax.set_xlabel("Time of day (hour)")
ax.set_ylabel("Weekday")
ax.set_title("Average Estimated NO2 by weekday and hour")
plt.tight_layout()
plt.savefig("estimated-no2-heatmap.png", dpi=300)

