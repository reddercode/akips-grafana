import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
} from '@grafana/data';
import { TSDBQuery, TSDBRequest, MetricValue, QueryResults } from './types';

export class DataSource extends DataSourceApi<TSDBQuery> {
  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings, private backendSrv: any) {
    super(instanceSettings);
  }

  async testDatasource() {
    const q: TSDBQuery = {
      datasourceId: this.id,
      type: 'testDatasource',
      refId: 'testDatasource',
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

  async metricFindQuery(request: string): Promise<MetricValue[]> {
    console.log('metricFindQuery', request);

    const q: TSDBQuery = {
      datasourceId: this.id,
      type: 'metricFindQuery',
      refId: 'metricFindQuery',
      query: request,
    };

    const { data }: { data: QueryResults } = await this.backendSrv.datasourceRequest({
      data: { queries: [q] } as TSDBRequest,
      method: 'POST',
      url: '/api/tsdb/query',
    });

    console.log(data);

    const res: MetricValue[] =
      data.results['metricFindQuery']?.tables?.[0].rows?.map<MetricValue>(row => ({
        text: String(row[0] || ''),
        value: row[1] !== undefined ? Number(row[1]) : undefined,
      })) || [];

    console.log(res);

    return res;
  }
}
