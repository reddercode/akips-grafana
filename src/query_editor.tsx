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
  selectedDevice?: SelectableValue<string> | null;
  children?: Array<SelectableValue<string>> | null;
  selectedChild?: SelectableValue<string> | null;
  attributes?: Array<SelectableValue<string>> | null;
  selectedAttribute?: SelectableValue<string> | null;
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
    const result = (await datasource.metricFindQuery('mlist device *')).map<SelectableValue<string>>(value => ({
      label: value.text,
      value: value.text,
    }));
    this.setState({
      devices: result,
      selectedDevice: null,
      children: null,
      selectedChild: null,
      attributes: null,
      selectedAttribute: null,
    });
  }

  async updateChildren(dev: string) {
    const { datasource } = this.props;
    const result = (await datasource.metricFindQuery(`mlist * "${dev}" *`)).map<SelectableValue<string>>(value => ({
      label: value.text,
      value: value.text,
    }));
    this.setState({
      children: result,
      selectedChild: null,
      attributes: null,
      selectedAttribute: null,
    });
  }

  async updateAttributes(dev: string, child: string) {
    const { datasource } = this.props;
    const result = (await datasource.metricFindQuery(`mlist * "${dev}" "${child}" *`)).map<SelectableValue<string>>(value => ({
      label: value.text,
      value: value.text,
    }));
    this.setState({
      attributes: result,
      selectedAttribute: null,
    });
  }

  onChangeQuery = (value: string, override?: boolean) => {
    const { query, onChange, onRunQuery } = this.props;
    if (onChange) {
      const q: TSDBQuery = { ...query, rawQuery: value };
      onChange(q);
      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  };

  onChangeDevice = (option: SelectableValue<string>) => {
    this.setState(
      {
        selectedDevice: option,
        children: null,
        selectedChild: null,
        attributes: null,
        selectedAttribute: null,
      },
      () => {
        this.onChangeQuery(this.formatDefaultQuery());
        if (option.value !== undefined) {
          this.updateChildren(option.value);
        }
      }
    );
  };

  onChangeChild = (option: SelectableValue<string>) => {
    this.setState(
      {
        selectedChild: option,
        attributes: null,
        selectedAttribute: null,
      },
      () => {
        this.onChangeQuery(this.formatDefaultQuery(), true);
        if (option.value !== undefined && this.state.selectedDevice?.value !== undefined) {
          this.updateAttributes(this.state.selectedDevice.value, option.value);
        }
      }
    );
  };

  onChangeAttribute = (option: SelectableValue<string>) => {
    this.setState(
      {
        selectedAttribute: option,
      },
      () => this.onChangeQuery(this.formatDefaultQuery(), true)
    );
  };

  formatDefaultQuery(): string {
    const { selectedDevice, selectedChild, selectedAttribute } = this.state;
    const dev = selectedDevice?.value || 'SELECT_DEVICE';
    const iface = selectedChild?.value || 'SELECT_INTERFACE';
    const attr = selectedAttribute?.value || '/InOctets|OutOctets/';
    return `series interval total $\{__interval_sec\} time "from $\{__from_sec\} to $\{__to_sec\}" * "${dev}" "${iface}" "${attr}"`;
  }

  render() {
    const { query } = this.props;
    const rawQuery = query.rawQuery || this.formatDefaultQuery();
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
          <label className="gf-form-label">Child</label>
          <Select
            options={this.state.children || []}
            onChange={this.onChangeChild}
            value={this.state.selectedChild as SelectableValue<string>}
            placeholder="Select a child (interface)"
          />
        </div>
        <div className="gf-form">
          <label className="gf-form-label">Attribute</label>
          <Select
            options={this.state.attributes || []}
            onChange={this.onChangeAttribute}
            value={this.state.selectedAttribute as SelectableValue<string>}
            placeholder="Select an attribute"
            isClearable
          />
        </div>
        <div className="gf-form gf-form--grow flex-shrink-1">
          <label className="gf-form-label">Query</label>
          <QueryField
            query={rawQuery}
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
