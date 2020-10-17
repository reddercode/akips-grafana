import { DataQueryRequest, ScopedVars, MetricFindValue, toDataFrame, DataSourceInstanceSettings } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { Query } from './types';

export class DataSource extends DataSourceWithBackend<Query> {
  static DEFAULT_QUERY =
    'series interval total ${__timeInterval} time "from ${__timeFrom} to ${__timeTo}" * "${__device}" "${__child}" "${__attribute}"';
  interval = '60s'; // declare minimal interval
  private templateSrv = getTemplateSrv();

  static shouldUpdate(q: Query): boolean {
    const hasDeviceVar = /\${?__device}?/.test(q.query || '');
    const hasChildVar = /\${?__child}?/.test(q.query || '');
    const hasAttributeVar = /\${?__attribute}?/.test(q.query || '');

    return (
      (hasDeviceVar || hasChildVar || hasAttributeVar) &&
      (!hasDeviceVar || (hasDeviceVar && !!q.device)) &&
      (!hasChildVar || (hasChildVar && !!q.child)) &&
      (!hasAttributeVar || (hasAttributeVar && !!q.attribute))
    );
  }

  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  /**
   * Convert a query to a simple text string
   */
  getQueryDisplayText(query: Query): string {
    return query.query || '';
  }

  // Variable query action.
  async metricFindQuery(request: string): Promise<MetricFindValue[]> {
    const targets: Query[] = [
      {
        refId: 'table',
        queryType: 'table',
        query: request,
        omitParents: true,
      },
    ];

    const response = await this.query({ targets } as DataQueryRequest<Query>).toPromise();
    if (response.data.length) {
      const df = toDataFrame(response.data[0]);
      if (df.fields.length && df.fields[0].type === 'string') {
        return df.fields[0].values.toArray().map((v) => ({ text: v }));
      }
    }
    return [];
  }

  // Called by DataSourceWithBackend::query
  applyTemplateVariables(query: Query, scopedVars?: ScopedVars): Query {
    return {
      ...query,
      query: this.templateSrv.replace(query.query, scopedVars),
    };
  }

  // Used in explore mode
  interpolateVariablesInQueries(queries: Query[], scopedVars: ScopedVars): Query[] {
    return queries.map((q) => ({
      ...q,
      query: this.templateSrv.replace(q.query, scopedVars),
    }));
  }
}
