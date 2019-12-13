import { QueryEditorProps } from '@grafana/data';
import { FormField } from '@grafana/ui';
import React, { ChangeEvent, PureComponent } from 'react';
import { DataSource } from './data_source';
import { TSDBQuery } from './types';

type Props = QueryEditorProps<DataSource, TSDBQuery>;

interface State {}

export class QueryEditor extends PureComponent<Props, State> {
  onComponentDidMount() {}

  onDeviceIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, deviceId: event.target.value });
  };

  onInterfaceIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query /*, onRunQuery*/ } = this.props;
    onChange({ ...query, interfaceId: event.target.value });
    // onRunQuery(); // executes the query
  };

  render() {
    const { deviceId, interfaceId } = this.props.query;
    return (
      <div className="gf-form">
        <FormField labelWidth={8} value={deviceId || ''} onChange={this.onDeviceIdChange} label="Device ID" tooltip="Not used yet"></FormField>
        <FormField
          labelWidth={8}
          value={interfaceId || ''}
          onChange={this.onInterfaceIdChange}
          label="Interface ID"
          tooltip="Not used yet"
        ></FormField>
      </div>
    );
  }
}
