import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { QueryEditor } from './query_editor';
import { ConfigEditor } from './config_editor';
import { Query } from './types';

export const plugin = new DataSourcePlugin<DataSource, Query>(DataSource).setConfigEditor(ConfigEditor).setQueryEditor(QueryEditor);
