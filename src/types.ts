import { DataQuery, MetricFindValue } from '@grafana/data';

type TSDBQueryType = 'testDatasource' | 'annotationQuery' | 'metricFindQuery' | 'timeSeriesQuery';

export interface TSDBQuery extends DataQuery {
  type: TSDBQueryType;
  datasourceId: number;
  rawQuery?: string; // keep raw query just for convenience --eugene
  query?: string;
}

export interface TSDBRequest {
  queries: TSDBQuery[];
  from?: string;
  to?: string;
}

export interface AKIPSSecureJSONData {
  password?: string;
}

export interface MetricValue extends MetricFindValue {
  value?: number;
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
