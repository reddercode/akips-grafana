import { DataQuery } from '@grafana/data';

export type QueryType = 'table' | 'time_series';

export interface Query extends DataQuery {
  queryType?: QueryType;
  query?: string;
  device?: string;
  child?: string;
  attribute?: string;
  singleValue?: boolean;
  omitParents?: boolean;
  legendFormat?: string;
  legendRegex?: boolean;
}

export interface AKIPSSecureJSONData {
  password?: string;
}
