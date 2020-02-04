import { ExploreQueryFieldProps, SelectableValue } from '@grafana/data';
import { QueryField, SlatePrism, Select, Switch, Input } from '@grafana/ui';
import React from 'react';
import Slate from 'slate';
import Prism from 'prismjs';
import { DataSource } from './datasource';
import { Query, QueryType, QueryOptions } from './types';
import syntax from './syntax';

interface AKIPSQueryFieldProps extends ExploreQueryFieldProps<DataSource, Query> {
  extOptions?: boolean;
}

interface AKIPSQueryFieldState {
  syntaxLoaded: boolean;
  devices?: Array<SelectableValue<string>> | null;
  selectedDevice?: SelectableValue<string> | null;
  children?: Array<SelectableValue<string>> | null;
  selectedChild?: SelectableValue<string> | null;
  attributes?: Array<SelectableValue<string>> | null;
  selectedAttribute?: SelectableValue<string> | null;
  queryType: SelectableValue<QueryType>;
}

const QUERY_TYPES: Array<SelectableValue<QueryType>> = [
  { label: 'Time series', value: 'timeSeriesQuery' },
  { label: 'Table', value: 'tableQuery' },
];

export class AKIPSQueryField extends React.PureComponent<AKIPSQueryFieldProps, AKIPSQueryFieldState> {
  plugins: Slate.Plugin[];

  constructor(props: AKIPSQueryFieldProps, context: React.Context<any>) {
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
      queryType: QUERY_TYPES.find(option => option.value === query.type) || QUERY_TYPES[0],
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

  componentDidUpdate(prevProps: AKIPSQueryFieldProps) {
    const { query } = this.props;
    const { query: prev } = prevProps;

    if (query.type !== prev.type) {
      this.setState({
        queryType: QUERY_TYPES.find(option => option.value === query.type) || QUERY_TYPES[0],
      });
    }

    if (query.device !== prev.device) {
      this.setState({
        selectedDevice: this.state.devices?.find(option => option.value === query.device) || null,
      });
    }

    if (query.child !== prev.child) {
      this.setState({
        selectedChild: this.state.children?.find(option => option.value === query.child) || null,
      });
    }

    if (query.attribute !== prev.attribute) {
      this.setState({
        selectedAttribute: this.state.attributes?.find(option => option.value === query.attribute) || null,
      });
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
      this.setState({
        selectedDevice: result.find(option => option.value === query.device) || null,
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
      this.setState({
        selectedChild: result.find(option => option.value === query.child) || null,
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
      this.setState({
        selectedAttribute: result.find(option => option.value === query.attribute) || null,
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
        this.changeQuery({ device: option?.value, child: undefined, attribute: undefined });
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
        this.changeQuery({ child: option?.value, attribute: undefined }, true);
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
      () => this.changeQuery({ attribute: option?.value }, true)
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

  onChangeLegendRegex = (evt?: React.SyntheticEvent<HTMLInputElement>) => {
    if (evt) {
      const value = evt.currentTarget.checked;
      this.changeQuery({ legendRegex: value }, true);
    }
  };

  extOptions(): JSX.Element | null {
    if (!this.props.extOptions) {
      return null;
    }
    const { query } = this.props;
    return (
      <>
        <Switch label="Single value" checked={query.singleValue || false} onChange={this.onChangeSingle} />
        {this.state.queryType?.value === 'tableQuery' ? (
          <Switch label="Omit parents" checked={query.omitParents || false} onChange={this.onChangeOmitParents} />
        ) : (
          <>
            <label className="gf-form-label">Legend</label>
            <Input
              value={query.legendFormat}
              onChange={event => this.changeQuery({ legendFormat: event.currentTarget.value }, true)}
              placeholder={query.legendRegex ? 'Enter a regex' : ''}
            />
            <Switch label="Regex" checked={query.legendRegex || false} onChange={this.onChangeLegendRegex} />
          </>
        )}
      </>
    );
  }

  render() {
    const { query } = this.props;
    const rawQuery = query.rawQuery || DataSource.DEFAULT_QUERY;
    return (
      <>
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
        </div>
        <div className="gf-form-inline">
          <div className="gf-form gf-form--grow flex-shrink-1">
            <label className="gf-form-label">Query</label>
            <QueryField
              query={rawQuery}
              additionalPlugins={this.plugins}
              onChange={value => this.changeQuery({ rawQuery: value })}
              onRunQuery={this.props.onRunQuery}
              onBlur={this.props.onBlur}
              placeholder="Enter an AKiPS query"
              portalOrigin="akips"
              syntaxLoaded={this.state.syntaxLoaded}
            />
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <label className="gf-form-label">Format</label>
            <Select isSearchable={false} options={QUERY_TYPES} onChange={this.onChangeType} value={this.state.queryType} />
            {this.extOptions()}
          </div>
        </div>
      </>
    );
  }
}
