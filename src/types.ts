import { DataQuery } from '@grafana/data';

export type QueryType = 'table' | 'time_series' | 'csv';

export interface Query extends DataQuery {
  queryType?: QueryType;
  query?: string;
  device?: string;
  child?: string;
  attribute?: string;
  omitParents?: boolean;
}

export interface AKIPSSecureJSONData {
  password?: string;
}
