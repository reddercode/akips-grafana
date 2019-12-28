import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  ScopedVars,
} from '@grafana/data';
import { TSDBQuery, TSDBRequest, MetricValue, QueryResults } from './types';

export class DataSource extends DataSourceApi<TSDBQuery> {
  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings, private backendSrv: any, private templateSrv: any) {
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
    const intervalSec = Math.floor(request.intervalMs / 1000);
    const fromSec = request.range.from.unix();
    const toSec = request.range.to.unix();

    const localVars: ScopedVars = {
      ...request.scopedVars,

      __interval_s: {
        text: String(intervalSec),
        value: intervalSec,
      },
      __from_s: {
        text: String(fromSec),
        value: fromSec,
      },
      __to_s: {
        text: String(toSec),
        value: toSec,
      },
    };

    for (const t of request.targets) {
      t.query = this.templateSrv.replace(t.rawQuery, localVars);
    }

    console.log('query', request);
    console.log('tpl', this.templateSrv);

    return new Promise<DataQueryResponse>(res => res({} as DataQueryResponse));
  }

  async annotationQuery(request: AnnotationQueryRequest<TSDBQuery>): Promise<AnnotationEvent[]> {
    console.log('annotationQuery', request);
    return new Promise<AnnotationEvent[]>(res => res([]));
  }

  async metricFindQuery(request: string): Promise<MetricValue[]> {
    const r = this.templateSrv.replace(request, {});

    console.log('metricFindQuery', request, r);

    const q: TSDBQuery = {
      datasourceId: this.id,
      type: 'metricFindQuery',
      refId: 'metricFindQuery',
      rawQuery: request,
      query: r,
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
