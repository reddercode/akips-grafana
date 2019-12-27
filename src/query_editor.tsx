import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { QueryField, SlatePrism, Select } from '@grafana/ui';
import React from 'react';
import Slate from 'slate';
import Prism from 'prismjs';
import { DataSource } from './datasource';
import { TSDBQuery } from './types';
import syntax from './syntax';

type Props = QueryEditorProps<DataSource, TSDBQuery>;

interface State {
  syntaxLoaded: boolean;
  devices?: Array<SelectableValue<string>> | null;
  interfaces?: Array<SelectableValue<string>> | null;
  selectedDevice?: SelectableValue<string> | null;
  selectedInterface?: SelectableValue<string> | null;
}

export class QueryEditor extends React.PureComponent<Props, State> {
  plugins: Slate.Plugin[];

  constructor(props: Props, context: React.Context<any>) {
    super(props, context);

    this.plugins = [
      SlatePrism({
        onlyIn: (node: Slate.Node) => node instanceof Slate.Block && node.type === 'code_block',
        getSyntax: (node: Slate.Node) => 'akips',
      }),
    ];

    this.state = {
      syntaxLoaded: false,
    };
  }

  componentDidMount() {
    Prism.languages['akips'] = syntax;
    this.setState({ syntaxLoaded: true });
    this.updateDevices();
  }

  async updateDevices() {
    const { datasource } = this.props;
    const result = (await datasource.metricFindQuery('mget device *')).map<SelectableValue<string>>(value => ({
      label: value.text,
      value: value.text,
    }));
    this.setState({ devices: result });
  }

  async updateInterfaces(dev: string) {
    const { datasource } = this.props;
    const result = (await datasource.metricFindQuery(`mget interface ${dev} *`)).map<SelectableValue<string>>(value => ({
      label: value.text,
      value: value.text,
    }));
    this.setState({ interfaces: result, selectedInterface: null });
  }

  onChangeQuery = (value: string, override?: boolean) => {
    console.log('onChangeQuery', value, override);

    const { query, onChange, onRunQuery } = this.props;
    if (onChange) {
      const q: TSDBQuery = { ...query, query: value };
      onChange(q);
      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  };

  onChangeDevice = (option: SelectableValue<string>) => {
    this.setState({
      selectedDevice: option,
      selectedInterface: null,
      interfaces: null,
    });
    if (option.value !== undefined) {
      this.updateInterfaces(option.value);
    }
  };

  onChangeInterface = (option: SelectableValue<string>) => {
    this.setState({ selectedInterface: option });
  };

  render() {
    const { query } = this.props;
    const cmd = query.query || null;
    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <label className="gf-form-label">Device</label>
          <Select
            options={this.state.devices || []}
            onChange={this.onChangeDevice}
            value={this.state.selectedDevice as SelectableValue<string>}
            placeholder="Select device"
          />
        </div>
        <div className="gf-form">
          <label className="gf-form-label">Interface</label>
          <Select
            options={this.state.interfaces || []}
            onChange={this.onChangeInterface}
            value={this.state.selectedInterface as SelectableValue<string>}
            placeholder="Select interface"
          />
        </div>
        <div className="gf-form gf-form--grow flex-shrink-1">
          <label className="gf-form-label">Query</label>
          <QueryField
            query={cmd}
            additionalPlugins={this.plugins}
            onChange={this.onChangeQuery}
            onRunQuery={this.props.onRunQuery}
            placeholder="Enter a AKiPS query"
            portalOrigin="akips"
            syntaxLoaded={this.state.syntaxLoaded}
          />
        </div>
      </div>
    );
  }
}
