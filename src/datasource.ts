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
  DataFrameDTO,
  FieldDTO,
  MetricFindValue,
} from '@grafana/data';
import { TSDBQuery, TSDBRequest, QueryResults } from './types';

export class DataSource extends DataSourceApi<TSDBQuery> {
  private static AKIPS_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
  private static unitSuffixes: { [key: string]: string } = {
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

  /**
   * Convert a query to a simple text string
   */
  getQueryDisplayText(query: TSDBQuery): string {
    return query.query || query.rawQuery || '';
  }

  // Use template engine to build AKiPS queries
  getLocalVars(query: DataQueryRequest<TSDBQuery>): ScopedVars {
    const intervalSec = Math.floor(query.intervalMs / 1000);
    const fromSec = query.range.from.unix();
    const fromFmt = query.range.from.format(DataSource.AKIPS_TIME_FORMAT);
    const toSec = query.range.to.unix();
    const toFmt = query.range.to.format(DataSource.AKIPS_TIME_FORMAT);

    return {
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
  }

  guessUnit(name: string): string | undefined {
    for (const s in DataSource.unitSuffixes) {
      if (name.endsWith(s)) {
        return DataSource.unitSuffixes[s];
      }
    }
    return undefined;
  }

  /**
   * Query for data, and optionally stream results
   */
  async query(request: DataQueryRequest<TSDBQuery>): Promise<DataQueryResponse> {
    const queries = request.targets
      .filter(q => !q.hide)
      .map<TSDBQuery>(q => ({
        refId: q.refId,
        type: 'timeSeriesQuery',
        datasourceId: this.id,
        rawQuery: q.rawQuery,
        query: this.templateSrv.replace(q.rawQuery, { ...request.scopedVars, ...this.getLocalVars(request) }),
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
              ...r.series?.map<FieldDTO>(s => ({
                type: FieldType.number,
                name: s.name || '',
                config: (unit => (unit ? { unit } : undefined))(this.guessUnit(s.name || '')),
                values: s.points?.map(v => v[0]),
              })),
              // The first time field only is used anyway --eugene
              ...r.series?.map<FieldDTO>(s => ({
                type: FieldType.time,
                name: s.name + ' time',
                values: s.points?.map(v => v[1]),
              })),
            ],
          } as DataFrameDTO)
      );

    return { data: result };
  }

  /**
   * Can be optionally implemented to allow datasource to be a source of annotations for dashboard. To be visible
   * in the annotation editor `annotations` capability also needs to be enabled in plugin.json.
   */
  async annotationQuery(request: AnnotationQueryRequest<TSDBQuery>): Promise<AnnotationEvent[]> {
    // TODO
    return [];
  }

  /**
   * Variable query action.
   */
  async metricFindQuery(request: string): Promise<MetricFindValue[]> {
    const r = this.templateSrv.replace(request, {});
    const q: TSDBQuery = {
      datasourceId: this.id,
      type: 'tableQuery',
      refId: 'tableQuery',
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

    let subjectIndex = 0;
    if (table.columns !== undefined) {
      if (table.columns.length > 1 && table.columns[1].text === 'Child') {
        subjectIndex = 1;
      }
      if (table.columns.length > 2 && table.columns[2].text === 'Attribute') {
        subjectIndex = 2;
      }
    }

    const res = table.rows?.map<MetricFindValue>(row => ({
      text: String(row[subjectIndex]) || '',
    }));
    return res || [];
  }

  // Used in explore mode
  interpolateVariablesInQueries(queries: TSDBQuery[]): TSDBQuery[] {
    return queries.map<TSDBQuery>(q => ({
      ...q,
      datasource: this.name,
      query: this.templateSrv.replace(q.rawQuery, {}),
    }));
  }
}
