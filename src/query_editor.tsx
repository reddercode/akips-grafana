import React from 'react';
import { QueryEditorProps } from '@grafana/data';
import { DataSource } from './datasource';
import { Query } from './types';
import { AKIPSQueryField } from './query_field';

type AKIPSQueryEditorProps = QueryEditorProps<DataSource, Query>;

export class AKIPSQueryEditor extends React.PureComponent<AKIPSQueryEditorProps> {
  constructor(props: AKIPSQueryEditorProps, context: React.Context<any>) {
    super(props, context);
  }

  render() {
    return (
      <AKIPSQueryField
        datasource={this.props.datasource}
        query={this.props.query}
        onChange={this.props.onChange}
        onRunQuery={this.props.onRunQuery}
        data={this.props.data}
        history={[]}
        extOptions
      />
    );
  }
}
