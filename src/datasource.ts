import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  ScopedVars,
  MutableDataFrame,
  FieldType,
  MetricFindValue,
  FieldDTO,
} from '@grafana/data';
import { Query, TSDBRequest, QueryResults, TimeSeries } from './types';

export class DataSource extends DataSourceApi<Query> {
  static DEFAULT_QUERY =
    'series interval total ${__interval_sec} time "from ${__from_sec} to ${__to_sec}" * "${__device}" "${__child}" "${__attribute}"';

  private static AKIPS_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
  private static UNIT_SUFFIXES: { [key: string]: string } = {
    Octets: 'bytes',
    BitRate: 'bps',
    Util: 'percent',
  };

  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings, private backendSrv: any, private templateSrv: any) {
    super(instanceSettings);
  }

  /**
   * Test & verify datasource settings & connection details
   */
  async testDatasource() {
    const q: Query = {
      datasourceId: this.id,
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

  /**
   * Convert a query to a simple text string
   */
  getQueryDisplayText(query: Query): string {
    return query.query || query.rawQuery || '';
  }

  // Use template engine to build AKiPS queries
  getLocalVars(query: DataQueryRequest<Query>, target: Query): ScopedVars {
    const intervalSec = Math.floor(query.intervalMs / 1000);
    const fromSec = query.range.from.unix();
    const fromFmt = query.range.from.format(DataSource.AKIPS_TIME_FORMAT);
    const toSec = query.range.to.unix();
    const toFmt = query.range.to.format(DataSource.AKIPS_TIME_FORMAT);

    return {
      __interval_sec: {
        text: String(intervalSec),
        value: intervalSec,
      },
      __from_sec: {
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
      __to_sec: {
        text: String(toSec),
        value: toSec,
      },
      __device: {
        text: target.device || '',
        value: target.device || '',
      },
      __child: {
        text: target.child || '',
        value: target.child || '',
      },
      __attribute: {
        text: target.attribute || '',
        value: target.attribute || '',
      },
    };
  }

  guessUnit(name: string): string | undefined {
    for (const s in DataSource.UNIT_SUFFIXES) {
      if (name.endsWith(s)) {
        return DataSource.UNIT_SUFFIXES[s];
      }
    }
    return undefined;
  }

  /**
   * Query for data, and optionally stream results
   */
  async query(request: DataQueryRequest<Query>): Promise<DataQueryResponse> {
    const req: DataQueryRequest<Query> = {
      ...request,
      // interval must be a multiple of 60 sec --eugene
      intervalMs: Math.ceil(request.intervalMs / 60000) * 60000,
    };

    const queries = req.targets
      .filter(q => !q.hide)
      .map<Query>(q => ({
        datasourceId: this.id,
        type: q.type || 'timeSeriesQuery',
        refId: q.refId,
        key: q.key,
        singleValue: q.singleValue,
        omitParents: q.omitParents,
        query: this.templateSrv.replace(q.rawQuery || DataSource.DEFAULT_QUERY, {
          ...req.scopedVars,
          ...this.getLocalVars(req, q),
        }),
        intervalMs: req.intervalMs,
        maxDataPoints: req.maxDataPoints,
      }));

    if (queries.length === 0) {
      return { data: [] };
    }

    const { data }: { data: QueryResults } = await this.backendSrv.datasourceRequest({
      data: {
        queries: queries,
        from: req.range?.from.valueOf().toString(),
        to: req.range?.to.valueOf().toString(),
      } as TSDBRequest,
      method: 'POST',
      url: '/api/tsdb/query',
    });

    const result = Object.values(data.results)
      .filter(r => r.series?.length || r.tables?.length)
      .map<MutableDataFrame>(
        r =>
          new MutableDataFrame(
            r.series?.length
              ? {
                  // Time series response
                  refId: r.refId,
                  fields: [
                    ...r.series?.map(s => ({
                      type: FieldType.number,
                      name: s.name || '',
                      config: (unit => (unit ? { unit } : undefined))(this.guessUnit(s.name || '')),
                      values: s.points?.map(v => v[0]),
                    })),
                    // The first time field only is used anyway --eugene
                    ...((s: TimeSeries | undefined) =>
                      s
                        ? [
                            {
                              type: FieldType.time,
                              name: 'Time',
                              config: { unit: 'dateTimeAsIso' },
                              values: s.points?.map(v => v[1]),
                            },
                          ]
                        : [])(r.series?.[0]),
                  ],
                }
              : {
                  // Table response
                  refId: r.refId,
                  fields:
                    r.tables?.[0].columns?.map<FieldDTO>((c, cidx) => ({
                      type: FieldType.string,
                      name: c.text,
                      values: r.tables?.[0].rows?.map(r => r[cidx]),
                    })) || [],
                }
          )
      );

    return { data: result };
  }

  /**
   * Can be optionally implemented to allow datasource to be a source of annotations for dashboard. To be visible
   * in the annotation editor `annotations` capability also needs to be enabled in plugin.json.
   */
  async annotationQuery(request: AnnotationQueryRequest<Query>): Promise<AnnotationEvent[]> {
    // TODO
    return [];
  }

  /**
   * Variable query action.
   */
  async metricFindQuery(request: string): Promise<MetricFindValue[]> {
    const r = this.templateSrv.replace(request, {});
    const q: Query = {
      datasourceId: this.id,
      type: 'tableQuery',
      refId: 'tableQuery',
      omitParents: true,
      rawQuery: request,
      query: r,
    };

    const { data }: { data: QueryResults } = await this.backendSrv.datasourceRequest({
      data: { queries: [q] } as TSDBRequest,
      method: 'POST',
      url: '/api/tsdb/query',
    });

    const table = data.results['tableQuery']?.tables?.[0];
    if (!table) {
      return [];
    }

    const res = table.rows?.map<MetricFindValue>(row => ({
      text: String(row[0]) || '',
    }));
    return res || [];
  }

  // Used in explore mode
  interpolateVariablesInQueries(queries: Query[]): Query[] {
    return queries.map<Query>(q => ({
      ...q,
      datasource: this.name,
      query: this.templateSrv.replace(q.rawQuery, {}),
    }));
  }
}
