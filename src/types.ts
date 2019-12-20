import { DataQuery, MetricFindValue } from '@grafana/data';

type TSDBQueryType = 'query' | 'listDev' | 'listIf' | 'test';

export interface TSDBQuery extends DataQuery {
  queryType: TSDBQueryType;
  datasourceId: number;
  deviceId?: string;
  interfaceId?: string;
  cmd?: string;
}

export interface TSDBRequest {
  queries: TSDBQuery[];
  from?: string;
  to?: string;
}

export interface AKIPSSecureJSONData {
  password?: string;
}

export interface Entity extends MetricFindValue {
  id: string;
  name: string;
}

export interface Sys extends Entity {
  ip4addr?: string;
  ip6addr?: string;
  ipaddr?: string;
  contact?: string;
  descr?: string;
  location?: string;
  uptime?: number;
}

export interface Enum {
  code: number;
  val: string;
  ctime: string;
  mtime: string;
}

export interface Interface extends Entity {
  alias?: string;
  descr?: string;
  ipAddr?: string;
  physAddress?: string;
  adminStatus?: Enum;
  operStatus?: Enum;
  type?: Enum;
  index: number;
  speed?: number;
}
