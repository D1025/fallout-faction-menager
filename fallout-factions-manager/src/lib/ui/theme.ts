import { theme, type ThemeConfig } from 'antd';

export const falloutTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#e0b84f',
    colorInfo: '#75c2ff',
    colorSuccess: '#5fcf8b',
    colorWarning: '#e6b84e',
    colorError: '#ff7a82',

    colorTextBase: '#f2f5ef',
    colorText: '#f2f5ef',
    colorTextSecondary: '#bcc6ba',
    colorTextTertiary: '#96a295',
    colorTextQuaternary: '#7d877f',
    colorTextLightSolid: '#11161d',

    colorBgBase: '#0c1015',
    colorBgLayout: '#090d12',
    colorBgContainer: '#131a22',
    colorBgElevated: '#1a232d',
    colorBorder: '#56677a',
    colorBorderSecondary: '#62758a',

    colorFillSecondary: '#202a35',
    colorFillTertiary: '#26313d',
    colorFillQuaternary: '#2c3846',

    colorErrorBg: '#3a1b23',
    colorSuccessBg: '#173427',
    colorWarningBg: '#3f3018',

    controlOutline: '#75c2ff',
    controlOutlineWidth: 2,

    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 10,
    controlHeight: 42,
    controlHeightLG: 48,
    controlHeightSM: 36,
    sizeStep: 4,
    sizeUnit: 4,
    fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: 15,
    lineHeight: 1.45,
  },
};
