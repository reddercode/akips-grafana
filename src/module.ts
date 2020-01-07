import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { AKIPSQueryEditor } from './query_editor';
import { AKIPSQueryField } from './query_field';
import { ConfigEditor } from './config_editor';
import { Query } from './types';

export const plugin = new DataSourcePlugin<DataSource, Query>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(AKIPSQueryEditor)
  .setExploreQueryField(AKIPSQueryField);
