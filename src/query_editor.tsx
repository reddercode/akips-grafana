import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { QueryField, SlatePrism, Select, Switch } from '@grafana/ui';
import React from 'react';
import Slate from 'slate';
import Prism from 'prismjs';
import { DataSource } from './datasource';
import { Query, QueryType, QueryOptions } from './types';
import syntax from './syntax';

type Props = QueryEditorProps<DataSource, Query>;

interface State {
  syntaxLoaded: boolean;
  devices?: Array<SelectableValue<string>> | null;
  selectedDevice?: SelectableValue<string> | null;
  children?: Array<SelectableValue<string>> | null;
  selectedChild?: SelectableValue<string> | null;
  attributes?: Array<SelectableValue<string>> | null;
  selectedAttribute?: SelectableValue<string> | null;
  queryType: SelectableValue<QueryType>;
}

export class QueryEditor extends React.PureComponent<Props, State> {
  plugins: Slate.Plugin[];

  private static QUERY_TYPES: Array<SelectableValue<QueryType>> = [
    { label: 'Time series', value: 'timeSeriesQuery' },
    { label: 'Table', value: 'tableQuery' },
  ];

  constructor(props: Props, context: React.Context<any>) {
    super(props, context);
    const { query } = props;

    this.plugins = [
      SlatePrism({
        onlyIn: (node: Slate.Node) => node instanceof Slate.Block && node.type === 'code_block',
        getSyntax: (node: Slate.Node) => 'akips',
      }),
    ];

    this.state = {
      syntaxLoaded: false,
      queryType: QueryEditor.QUERY_TYPES.find(option => option.value === query.type) || QueryEditor.QUERY_TYPES[0],
    };
  }

  componentDidMount() {
    const { query } = this.props;

    Prism.languages['akips'] = syntax;
    this.setState({ syntaxLoaded: true });

    this.updateDevices();
    if (query.device) {
      this.updateChildren(query.device);
      if (query.child) {
        this.updateAttributes(query.device, query.child);
      }
    }
  }

  async updateDevices() {
    const { datasource, query } = this.props;
    const result = (await datasource.metricFindQuery('mlist device *')).map<SelectableValue<string>>(value => ({
      label: value.text,
      value: value.text,
    }));

    this.setState({
      devices: result,
    });

    if (query.device) {
      const selected = result.find(option => option.value === query.device);
      this.setState({
        selectedDevice: selected || null,
      });
    }
  }

  async updateChildren(dev: string) {
    const { datasource, query } = this.props;
    const result = (await datasource.metricFindQuery(`mlist * "${dev}" *`)).map<SelectableValue<string>>(value => ({
      label: value.text,
      value: value.text,
    }));

    this.setState({
      children: result,
    });

    if (query.child) {
      const selected = result.find(option => option.value === query.child);
      this.setState({
        selectedChild: selected || null,
      });
    }
  }

  async updateAttributes(dev: string, child: string) {
    const { datasource, query } = this.props;
    const result = (await datasource.metricFindQuery(`mlist * "${dev}" "${child}" *`)).map<SelectableValue<string>>(value => ({
      label: value.text,
      value: value.text,
    }));

    this.setState({
      attributes: result,
    });

    if (query.attribute) {
      const selected = result.find(option => option.value === query.attribute);
      this.setState({
        selectedAttribute: selected || null,
      });
    }
  }

  changeQuery(values: QueryOptions, override?: boolean) {
    const { query, onChange, onRunQuery } = this.props;
    if (onChange) {
      const q: Query = { ...query, ...values };
      onChange(q);
      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  }

  onChangeDevice = (option: SelectableValue<string> | null) => {
    this.setState(
      {
        selectedDevice: option,
        children: null,
        selectedChild: null,
        attributes: null,
        selectedAttribute: null,
      },
      () => {
        this.changeQuery({ rawQuery: this.formatDefaultQuery(), device: option?.value, child: undefined, attribute: undefined });
        if (option?.value) {
          this.updateChildren(option.value);
        }
      }
    );
  };

  onChangeChild = (option: SelectableValue<string> | null) => {
    this.setState(
      {
        selectedChild: option,
        attributes: null,
        selectedAttribute: null,
      },
      () => {
        this.changeQuery({ rawQuery: this.formatDefaultQuery(), child: option?.value, attribute: undefined }, true);
        if (option?.value && this.state.selectedDevice?.value) {
          this.updateAttributes(this.state.selectedDevice.value, option.value);
        }
      }
    );
  };

  onChangeAttribute = (option: SelectableValue<string> | null) => {
    this.setState(
      {
        selectedAttribute: option,
      },
      () => this.changeQuery({ rawQuery: this.formatDefaultQuery(), attribute: option?.value }, true)
    );
  };

  onChangeType = (option: SelectableValue<QueryType>) => {
    this.setState({ queryType: option }, () => this.changeQuery({ type: option.value }, true));
  };

  onChangeSingle = (evt?: React.SyntheticEvent<HTMLInputElement>) => {
    if (evt) {
      const value = evt.currentTarget.checked;
      this.changeQuery({ singleValue: value }, true);
    }
  };

  onChangeOmitParents = (evt?: React.SyntheticEvent<HTMLInputElement>) => {
    if (evt) {
      const value = evt.currentTarget.checked;
      this.changeQuery({ omitParents: value }, true);
    }
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
            isClearable
          />
        </div>
        <div className="gf-form">
          <label className="gf-form-label">Child</label>
          <Select
            options={this.state.children || []}
            onChange={this.onChangeChild}
            value={this.state.selectedChild as SelectableValue<string>}
            placeholder="Select a child (interface)"
            isClearable
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
            onChange={value => this.changeQuery({ rawQuery: value })}
            onRunQuery={this.props.onRunQuery}
            placeholder="Enter a AKiPS query"
            portalOrigin="akips"
            syntaxLoaded={this.state.syntaxLoaded}
          />
        </div>
        <div className="gf-form">
          <label className="gf-form-label">Format</label>
          <Select isSearchable={false} options={QueryEditor.QUERY_TYPES} onChange={this.onChangeType} value={this.state.queryType} />
          <Switch label="Single value" checked={query.singleValue || false} onChange={this.onChangeSingle} />
          {this.state.queryType?.value === 'tableQuery' && (
            <Switch label="Omit parents" checked={query.omitParents || false} onChange={this.onChangeOmitParents} />
          )}
        </div>
      </div>
    );
  }
}
