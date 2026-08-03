import xarray as xr
# import matplotlib as plt
import pandas as pd
from math import sqrt
import numpy as np


from sklearn import linear_model
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score, root_mean_squared_error 
from sklearn.preprocessing import StandardScaler

import warnings
warnings.filterwarnings('ignore')

datapath = "/home/nlring/Documents/01_Research/larc-chicago-haq/datasets/"

#Choose whether to save plots
save_plots = False

# Change some of the default xarray settings
xr.set_options(keep_attrs=True, display_expand_data=False)

def rmse(x,y):
    out = sqrt(mean_squared_error(x,y))
    return out

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

hourly = pd.read_csv(datapath+"fulldat-hourly-timeseries.csv")
hourly['datetime'] = pd.to_datetime(hourly['datetime'], errors='coerce')
hourly['month'] = hourly['datetime'].dt.month
hourly['hour'] = hourly['datetime'].dt.hour
hourly['weekday'] = hourly['datetime'].dt.weekday
hourly['season'] = hourly['month'].map(season_map)


var_select = ['sfc_no2_mean','col_no2_mean','pbl_mean', 'solar_zenith_mean', 'u10m_mean','v10m_mean']
target_col = 'sfc_no2_mean'
feature_cols = ['col_no2_mean', 'pbl_mean', 'solar_zenith_mean','u10m_mean','v10m_mean']
meta_cols = ['datetime', 'latitude', 'longitude']

def estimate_no2_from_model(x):
    return (
        intercept
        + coef[0] * x['col_no2_mean']
        + coef[1] * x['pbl_mean']
        + coef[2] * x['solar_zenith_mean']
        + coef[3] * x['u10m_mean']
        + coef[4] * x['v10m_mean']
    )

hourly = hourly.mask(hourly['season']=='Summer')

month_results = []
monthly_estimates = []
scale_factor_rows = []

for season in sorted(hourly['season'].dropna().unique()):
    for weekday in sorted(hourly['weekday'].dropna().unique()):
        month_frame = hourly.loc[
            ((hourly['weekday'] == weekday) & (hourly['season']==season)),
            meta_cols + var_select
        ].dropna().copy()
        if len(month_frame) < 10:
            continue

        train_df, test_df = train_test_split(month_frame, test_size=0.2, random_state=42)

        scaler_x = StandardScaler().fit(train_df[feature_cols])
        scaler_y = StandardScaler().fit(train_df[[target_col]])

        for feature_name, feature_mean, feature_scale in zip(feature_cols, scaler_x.mean_, scaler_x.scale_):
            scale_factor_rows.append({
                'season': season,
                'weekday': weekday,
                'scaler': 'x',
                'variable': feature_name,
                'mean': float(feature_mean),
                'scale_factor': float(feature_scale),
            })

        scale_factor_rows.append({
            'season': season,
            'weekday': weekday,
            'scaler': 'y',
            'variable': target_col,
            'mean': float(scaler_y.mean_[0]),
            'scale_factor': float(scaler_y.scale_[0]),
        })

        x_train = pd.DataFrame(scaler_x.transform(train_df[feature_cols]), columns=feature_cols, index=train_df.index)
        x_test = pd.DataFrame(scaler_x.transform(test_df[feature_cols]), columns=feature_cols, index=test_df.index)

        y_train = pd.Series(scaler_y.transform(train_df[[target_col]]).ravel(), name=target_col, index=train_df.index)
        y_test = pd.Series(scaler_y.transform(test_df[[target_col]]).ravel(), name=target_col, index=test_df.index)

        model = linear_model.LinearRegression().fit(X=x_train, y=y_train)

        intercept = float(model.intercept_)
        coef = np.ravel(model.coef_)

        train_est_scaled = x_train.apply(estimate_no2_from_model, axis=1)
        test_est_scaled = x_test.apply(estimate_no2_from_model, axis=1)

        train_estimates = scaler_y.inverse_transform(pd.DataFrame(train_est_scaled, columns=['no2_estimate'])).ravel()
        test_estimates = scaler_y.inverse_transform(pd.DataFrame(test_est_scaled, columns=['no2_estimate'])).ravel()

        train_estimates_2 = scaler_y

        train_est = train_df[meta_cols + ['sfc_no2_mean','col_no2_mean']].copy()
        train_est['no2_estimate'] = train_estimates
        train_est['weekday'] = weekday 
        train_est['season'] = season
        train_est['split'] = 'train'
        train_est['residual'] = train_est['no2_estimate'] - train_est['sfc_no2_mean']

        test_est = test_df[meta_cols + ['sfc_no2_mean','col_no2_mean']].copy()
        test_est['no2_estimate'] = test_estimates
        test_est['weekday'] = weekday 
        test_est['season'] = season
        test_est['split'] = 'test'
        test_est['residual'] = test_est['no2_estimate'] - test_est['sfc_no2_mean']


        monthly_estimates.append(pd.concat([train_est, test_est], axis=0))

        month_results.append({
            'weekday': weekday,
            'season': season,
            'train_rows': len(train_df),
            'test_rows': len(test_df),
            'train_r2': r2_score(y_train, model.predict(x_train)),
            'test_r2': r2_score(y_test, model.predict(x_test)),
            'train_rmse': root_mean_squared_error(y_train, model.predict(x_train)),
            'test_rmse': root_mean_squared_error(y_test, model.predict(x_test)),
            'intercept': intercept,
            'coef_col_no2': float(coef[0]),
            'coef_pbl': float(coef[1]),
            'coef_sza': float(coef[2]),
            'coef_u10m': float(coef[3]),
            'coef_v10m': float(coef[4]),
        })

model_vals = pd.DataFrame(month_results)
model_vals.to_csv(datapath+"seasonal-weekday-model-values.csv")

monthly_estimates_df = pd.concat(monthly_estimates, axis=0, ignore_index=True)

monthly_estimates_df = monthly_estimates_df.sort_values(by='datetime')
monthly_estimates_df['month'] = monthly_estimates_df['datetime'].dt.month

monthly_estimates_df.to_csv(datapath + "seasonal-dayofweek-no2-estimates.csv")

scale_factors = pd.DataFrame(scale_factor_rows)

scale_factor_means = scale_factors.pivot(index=['season', 'weekday'], columns='variable', values='mean').add_prefix('scale_mean_')
scale_factor_values = scale_factors.pivot(index=['season', 'weekday'], columns='variable', values='scale_factor').add_prefix('scale_fact_')
scale_factor_wide = pd.concat([scale_factor_means, scale_factor_val])

pixel_rast = rel_ent_pixel_wide.set_index(['latitude', 'longitude']).to_xarray()


scale_factors.to_csv(datapath + 'seasonal-weekday-scale-factors.csv', index=False)
scale_factor_wide.to_csv(datapath + 'seasonal-weekday-scale-factors-wide.csv', index=False)

