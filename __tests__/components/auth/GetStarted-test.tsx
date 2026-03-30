jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'gradient', ...props }, children),
  };
});

jest.mock('react-native-svg', () => {
  const React = require('react');
  return {
    SvgXml: (props: any) => React.createElement('SvgXml', props),
  };
});

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
}));

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  const AnimatedView = React.forwardRef(function AnimatedView({ children, style, ...props }: any, ref: any) {
    return React.createElement(View, { ...props, style, ref }, children);
  });
  const Reanimated = { View: AnimatedView };
  return {
    __esModule: true,
    default: Reanimated,
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withRepeat: jest.fn(),
    withTiming: jest.fn(),
    Easing: { linear: 'linear' },
    createAnimatedComponent: (Component: any) => {
      return React.forwardRef(function Animated(props: any, ref: any) {
        return React.createElement(Component, {...props, ref});
      });
    },
  };
});

// Also mock Animated from react-native-reanimated so Animated.View resolves
jest.mock('react-native/Libraries/Animated/Animated', () => {
  return jest.requireActual('react-native/Libraries/Animated/Animated');
});

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');

  const BottomSheet = React.forwardRef(function BottomSheet({ children }: any, ref: any) {
    React.useImperativeHandle(ref, () => ({
      expand: jest.fn(),
      close: jest.fn(),
    }));
    return React.createElement(View, { testID: 'bottom-sheet' }, children);
  });

  const BottomSheetTextInput = React.forwardRef(function BottomSheetTextInput(props: any, ref: any) {
    return React.createElement('TextInput', { ...props, ref });
  });

  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetBackdrop: function BottomSheetBackdrop(props: any) { return React.createElement(View, props); },
    BottomSheetTextInput,
    BottomSheetView: function BottomSheetView({ children, ...props }: any) { return React.createElement(View, props, children); },
  };
});

jest.mock('@/components/auth/ConnectSheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    ConnectSheet: React.forwardRef(function ConnectSheet(_: any, ref: any) {
      React.useImperativeHandle(ref, () => ({
        expand: jest.fn(),
        close: jest.fn(),
        snapToIndex: jest.fn(),
        snapToPosition: jest.fn(),
        collapse: jest.fn(),
        forceClose: jest.fn(),
      }));
      return React.createElement(View, { testID: 'connect-sheet' });
    }),
  };
});

jest.mock('@/components/AurralLogo', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    AurralLogo: function AurralLogo(props: any) { return React.createElement(View, { testID: 'aurral-logo', ...props }); },
  };
});

import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import GetStartedScreen from '@/app/(auth)/get-started';

describe('GetStartedScreen', () => {
  it('renders headline text', () => {
    const { getByText } = render(<GetStartedScreen />);
    expect(getByText(/A new way to/)).toBeTruthy();
    expect(getByText('discover')).toBeTruthy();
    expect(getByText('Powered by your library')).toBeTruthy();
  });

  it('renders the Get Started button', () => {
    const { getByText } = render(<GetStartedScreen />);
    expect(getByText('Get Started')).toBeTruthy();
  });

  it('renders the Aurral logo', () => {
    const { getByTestId } = render(<GetStartedScreen />);
    expect(getByTestId('aurral-logo')).toBeTruthy();
  });

  it('renders the ConnectSheet', () => {
    const { getByTestId } = render(<GetStartedScreen />);
    expect(getByTestId('connect-sheet')).toBeTruthy();
  });

  it('triggers haptic feedback on Get Started press', async () => {
    const { getByText } = render(<GetStartedScreen />);
    fireEvent.press(getByText('Get Started'));
    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });
  });

  it('renders gradient overlay', () => {
    const { getByTestId } = render(<GetStartedScreen />);
    expect(getByTestId('gradient')).toBeTruthy();
  });
});
