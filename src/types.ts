import { DataQuery, MetricFindValue } from '@grafana/data';

type TSDBQueryType = 'testDatasource' | 'annotationQuery' | 'metricFindQuery' | 'timeSeriesQuery';

export interface TSDBQuery extends DataQuery {
  type: TSDBQueryType;
  datasourceId: number;
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
  points?: Point[];
}

export interface Point {
  timestamp: number;
  value: number;
}

export interface TableColumn {
  text: string;
}

export interface RowValue {
  kind?: number;
  doubleValue?: number;
  int64Value?: number;
  boolValue?: boolean;
  stringValue?: string;
  bytesValue?: string;
}

export interface TableRow {
  values: RowValue[];
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
