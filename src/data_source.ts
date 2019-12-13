import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  MetricFindValue,
} from '@grafana/data';
import { TSDBQuery, TSDBRequest } from './types';

export class DataSource extends DataSourceApi<TSDBQuery> {
  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings, private backendSrv: any) {
    super(instanceSettings);
  }

  async testDatasource() {
    const q: TSDBQuery = {
      datasourceId: this.id,
      queryType: 'test',
      refId: 'test',
    };

    const ret = await this.backendSrv.datasourceRequest({
      data: { queries: [q] } as TSDBRequest,
      method: 'POST',
      url: '/api/tsdb/query',
    });

    console.log(ret);
  }

  async query(request: DataQueryRequest<TSDBQuery>): Promise<DataQueryResponse> {
    return new Promise<DataQueryResponse>(res => res({} as DataQueryResponse));
  }

  async annotationQuery(request: AnnotationQueryRequest<TSDBQuery>): Promise<AnnotationEvent[]> {
    return new Promise<AnnotationEvent[]>(res => res([]));
  }

  async metricFindQuery(query: string): Promise<MetricFindValue[]> {
    return new Promise<MetricFindValue[]>(res => res([]));
  }
}
