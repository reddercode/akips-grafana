import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { QueryEditor } from './query_editor';
import { ConfigEditor } from './config_editor';
import { TSDBQuery } from './types';

export const plugin = new DataSourcePlugin<DataSource, TSDBQuery>(DataSource).setConfigEditor(ConfigEditor).setQueryEditor(QueryEditor);
