/** The 11 features the XGBoost model was trained on, in the service's snake_case names. */
export interface MlFeatures {
  amount: number;
  transaction_count_last_5min: number;
  amount_last_5min: number;
  unique_receivers_last_5min: number;
  unique_senders_last_5min: number;
  failed_withdrawals_last_10min: number;
  transaction_hour: number;
  avg_user_amount: number;
  amount_deviation: number;
  account_age_days: number;
  balance: number;
}
