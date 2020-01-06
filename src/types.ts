import { DataQuery } from '@grafana/data';

export type QueryType = 'annotationQuery' | 'tableQuery' | 'timeSeriesQuery';

export interface QueryOptions {
  type?: QueryType;
  rawQuery?: string;
  query?: string;
  singleValue?: boolean;
  intervalMs?: number;
  maxDataPoints?: number;
  // Never exposed to backend, just to keep editor state
  device?: string;
  child?: string;
  attribute?: string;
  omitParents?: boolean;
}

export interface Query extends DataQuery, QueryOptions {
  datasourceId: number;
}

export interface TSDBRequest {
  queries: Query[];
  from?: string;
  to?: string;
}

export interface AKIPSSecureJSONData {
  password?: string;
}

export interface TimeSeries {
  name?: string;
  tags?: { [key: string]: string };
  points?: number[][];
}

export interface TableColumn {
  text: string;
}

export interface Table {
  columns?: TableColumn[];
  rows?: any[][];
}

export interface QueryResult {
  error?: string;
  refId?: string;
  metaJson?: string;
  series?: TimeSeries[];
  tables?: Table[];
}

export interface QueryResults {
  results: { [key: string]: QueryResult };
}
