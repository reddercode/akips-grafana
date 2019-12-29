import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  ScopedVars,
  TIME_FORMAT,
  MutableDataFrame,
  FieldType,
  DataFrameDTO,
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
    const fromFmt = request.range.from.format(TIME_FORMAT);
    const toSec = request.range.to.unix();
    const toFmt = request.range.to.format(TIME_FORMAT);

    const localVars: ScopedVars = {
      __interval_s: {
        text: String(intervalSec),
        value: intervalSec,
      },
      __from_s: {
        text: String(fromSec),
        value: fromSec,
      },
      __from_datetime: {
        text: fromFmt,
        value: fromFmt,
      },
      __to_datetime: {
        text: toFmt,
        value: toFmt,
      },
      __to_s: {
        text: String(toSec),
        value: toSec,
      },
    };

    const queries = request.targets
      .filter(q => !q.hide)
      .map<TSDBQuery>(q => ({
        refId: q.refId,
        type: 'timeSeriesQuery',
        datasourceId: this.id,
        rawQuery: q.rawQuery,
        query: this.templateSrv.replace(q.rawQuery, { ...request.scopedVars, ...localVars }),
        key: q.key,
      }));

    if (queries.length === 0) {
      return { data: [] };
    }

    const { data }: { data: QueryResults } = await this.backendSrv.datasourceRequest({
      data: {
        queries: queries,
        from: request.range?.from.valueOf().toString(),
        to: request.range?.to.valueOf().toString(),
      } as TSDBRequest,
      method: 'POST',
      url: '/api/tsdb/query',
    });

    console.log(data);

    const result = Object.values(data.results)
      .filter(r => r.series !== null && r.series !== undefined)
      .map<MutableDataFrame>(
        r =>
          new MutableDataFrame({
            refId: r.refId,
            fields: [
              ...r.series?.map(s => ({
                type: FieldType.number,
                name: s.name,
                values: s.points?.map(v => v[0]),
              })),
              // The first time field only is used anyway --eugene
              ...r.series?.map(s => ({
                type: FieldType.time,
                name: s.name + ' time',
                values: s.points?.map(v => v[1]),
              })),
            ],
          } as DataFrameDTO)
      );

    console.log(result);

    return { data: result };
  }

  async annotationQuery(request: AnnotationQueryRequest<TSDBQuery>): Promise<AnnotationEvent[]> {
    console.log('annotationQuery', request);
    return [];
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
