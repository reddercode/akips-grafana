import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
} from '@grafana/data';
import { TSDBQuery, TSDBRequest, Entity } from './types';

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

    try {
      await this.backendSrv.datasourceRequest({
        data: { queries: [q] } as TSDBRequest,
        method: 'POST',
        url: '/api/tsdb/query',
      });
      return {
        status: 'success',
        message: 'Success',
      };
    } catch (err) {
      return {
        status: 'error',
        message: err.data.message,
      };
    }
  }

  async query(request: DataQueryRequest<TSDBQuery>): Promise<DataQueryResponse> {
    console.log('query', request);
    return new Promise<DataQueryResponse>(res => res({} as DataQueryResponse));
  }

  async annotationQuery(request: AnnotationQueryRequest<TSDBQuery>): Promise<AnnotationEvent[]> {
    console.log('annotationQuery', request);
    return new Promise<AnnotationEvent[]>(res => res([]));
  }

  async metricFindQuery(request: string): Promise<Entity[]> {
    console.log('metricFindQuery', request);
    return new Promise<Entity[]>(res => res([]));
  }
}
