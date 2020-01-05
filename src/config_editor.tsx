import React from 'react';
import { css, cx } from 'emotion';
import { FormField, Input, SecretFormField } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { AKIPSSecureJSONData } from './types';

export class ConfigEditor extends React.PureComponent<DataSourcePluginOptionsEditorProps> {
  render() {
    const { options, onOptionsChange } = this.props;
    const { secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as AKIPSSecureJSONData;
    const isValidUrl = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(options.url);
    const defaultUrl = 'http://localhost:9090';
    const notValidStyle = css`
      box-shadow: inset 0 0px 5px red;
    `;

    const inputStyle = cx({ [`width-20`]: true, [notValidStyle]: !isValidUrl });

    const urlInput = (
      <Input
        className={inputStyle}
        placeholder={defaultUrl}
        value={options.url}
        onChange={event => onOptionsChange({ ...options, url: event.currentTarget.value })}
      />
    );

    return (
      <div className="gf-form-group">
        <>
          <h3 className="page-heading">HTTP</h3>
          <div className="gf-form-group">
            <div className="gf-form">
              <FormField label="URL" labelWidth={11} tooltip="Specify a complete HTTP URL (for example http://your_server:8080)" inputEl={urlInput} />
            </div>
          </div>
        </>
        <>
          <h3 className="page-heading">Auth</h3>
          <div className="gf-form-group">
            <div className="gf-form">
              <SecretFormField
                isConfigured={(secureJsonFields && secureJsonFields.password) as boolean}
                value={secureJsonData.password || ''}
                inputWidth={18}
                labelWidth={10}
                onReset={() =>
                  onOptionsChange({
                    ...options,
                    secureJsonFields: {
                      ...options.secureJsonFields,
                      password: false,
                    },
                    secureJsonData: {
                      ...options.secureJsonData,
                      password: '',
                    },
                  })
                }
                onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                  onOptionsChange({
                    ...options,
                    secureJsonData: {
                      password: event.currentTarget.value,
                    },
                  })
                }
              />
            </div>
          </div>
        </>
      </div>
    );
  }
}
