import { DataQuery } from '@grafana/data';

type TSDBQueryType = 'query' | 'search' | 'test';

export interface TSDBQuery extends DataQuery {
  queryType: TSDBQueryType;
  datasourceId: number;
  deviceId?: string;
  interfaceId?: string;
}

export interface TSDBRequest {
  queries: TSDBQuery[];
  from?: string;
  to?: string;
}

export interface AKIPSSecureJSONData {
  password?: string;
}
