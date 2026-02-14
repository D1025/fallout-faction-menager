import { theme, type ThemeConfig } from 'antd';

export const falloutTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#e0b84f',
    colorPrimaryHover: '#ebcc72',
    colorPrimaryActive: '#cfaa44',
    colorInfo: '#b3ca7b',
    colorSuccess: '#8ebf72',
    colorWarning: '#e6b84e',
    colorError: '#ff7a82',

    colorTextBase: '#f2f5ef',
    colorText: '#f2f5ef',
    colorTextSecondary: '#bcc6ba',
    colorTextTertiary: '#96a295',
    colorTextQuaternary: '#7d877f',
    colorTextLightSolid: '#12180f',

    colorBgBase: '#0d120f',
    colorBgLayout: '#0b100d',
    colorBgContainer: '#121a16',
    colorBgElevated: '#1b2520',
    colorBorder: '#657668',
    colorBorderSecondary: '#4d5c50',
    colorLink: '#d9c27a',
    colorLinkHover: '#e8d59d',
    colorLinkActive: '#c8ad61',

    colorFillSecondary: '#202b25',
    colorFillTertiary: '#26342d',
    colorFillQuaternary: '#2e3f36',

    colorErrorBg: '#3a1b23',
    colorSuccessBg: '#233823',
    colorWarningBg: '#3f3018',

    controlOutline: '#c7d88e',
    controlOutlineWidth: 2,

    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 10,
    controlHeight: 42,
    controlHeightLG: 48,
    controlHeightSM: 36,
    sizeStep: 4,
    sizeUnit: 4,
    fontFamily: '"Bahnschrift", "Segoe UI Variable Text", "Trebuchet MS", sans-serif',
    fontSize: 15,
    lineHeight: 1.45,
  },
};
