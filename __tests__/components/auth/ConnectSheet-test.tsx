jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@/hooks/use-server-connect', () => ({
  useServerConnect: jest.fn(() => ({
    mutate: jest.fn(),
    reset: jest.fn(),
    isPending: false,
    error: null,
  })),
}));

jest.mock('@/lib/api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    isNetworkError: boolean;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.isNetworkError = status === 0;
    }
  },
}));

let capturedOnChange: ((index: number) => void) | undefined;

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const { View, TextInput } = require('react-native');

  const BottomSheet = React.forwardRef(({ children, onChange }: any, ref: any) => {
    capturedOnChange = onChange;
    React.useImperativeHandle(ref, () => ({ expand: jest.fn(), close: jest.fn() }));
    return React.createElement(View, { testID: 'bottom-sheet' }, children);
  });

  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetBackdrop: (props: any) => React.createElement(View, props),
    BottomSheetTextInput: (props: any) => React.createElement(TextInput, props),
    BottomSheetView: ({ children, ...props }: any) => React.createElement(View, props, children),
  };
});

import React from 'react';
import { Keyboard, Linking } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ConnectSheet } from '@/components/auth/ConnectSheet';
import { useServerConnect } from '@/hooks/use-server-connect';
import * as Haptics from 'expo-haptics';

const mockUseServerConnect = useServerConnect as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseServerConnect.mockReturnValue({
    mutate: jest.fn(),
    reset: jest.fn(),
    isPending: false,
    error: null,
  });
});

describe('ConnectSheet', () => {
  it('renders title and subtitle', () => {
    const { getByText } = render(<ConnectSheet />);
    expect(getByText('Connect to Server')).toBeTruthy();
    expect(getByText('Enter the URL of your Aurral server')).toBeTruthy();
  });

  it('renders GitHub link and opens URL on press', () => {
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { getByText } = render(<ConnectSheet />);
    const link = getByText('How can I get my own Aurral server?');
    expect(link).toBeTruthy();
    fireEvent.press(link);
    expect(openURLSpy).toHaveBeenCalledWith('https://github.com/lklynet/aurral#readme');
    openURLSpy.mockRestore();
  });

  it('renders input field with correct placeholder', () => {
    const { getByPlaceholderText } = render(<ConnectSheet />);
    expect(getByPlaceholderText('https://your-server.example.com')).toBeTruthy();
  });

  it('renders connect button', () => {
    const { getByText } = render(<ConnectSheet />);
    expect(getByText('Connect')).toBeTruthy();
  });

  it('calls mutate with valid URL on button press', async () => {
    const mutate = jest.fn();
    mockUseServerConnect.mockReturnValue({
      mutate,
      reset: jest.fn(),
      isPending: false,
      error: null,
    });

    const { getByPlaceholderText, getByText } = render(<ConnectSheet />);
    fireEvent.changeText(
      getByPlaceholderText('https://your-server.example.com'),
      'https://my-server.com',
    );
    fireEvent.press(getByText('Connect'));

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith('https://my-server.com');
    });
  });

  it('does not call mutate with invalid URL', async () => {
    const mutate = jest.fn();
    const reset = jest.fn();
    mockUseServerConnect.mockReturnValue({
      mutate,
      reset,
      isPending: false,
      error: null,
    });

    const { getByPlaceholderText, getByText } = render(<ConnectSheet />);
    fireEvent.changeText(
      getByPlaceholderText('https://your-server.example.com'),
      'not-a-url',
    );
    fireEvent.press(getByText('Connect'));

    await waitFor(() => {
      expect(reset).toHaveBeenCalled();
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('shows validation error for non-http URL', () => {
    const { getByPlaceholderText, getByText } = render(<ConnectSheet />);
    fireEvent.changeText(
      getByPlaceholderText('https://your-server.example.com'),
      'ftp://bad-protocol.com',
    );

    expect(getByText('URL must start with http:// or https://')).toBeTruthy();
  });

  it('shows network error from mutation', () => {
    const { ApiError } = require('@/lib/api/client');
    mockUseServerConnect.mockReturnValue({
      mutate: jest.fn(),
      reset: jest.fn(),
      isPending: false,
      error: new ApiError(0, 'Network error'),
    });

    const { getByText } = render(<ConnectSheet />);
    expect(getByText('Could not reach server. Check the URL and try again.')).toBeTruthy();
  });

  it('disables input when pending', () => {
    mockUseServerConnect.mockReturnValue({
      mutate: jest.fn(),
      reset: jest.fn(),
      isPending: true,
      error: null,
    });

    const { getByPlaceholderText } = render(<ConnectSheet />);
    const input = getByPlaceholderText('https://your-server.example.com');
    expect(input.props.editable).toBe(false);
  });

  it('dismisses keyboard when sheet closes', () => {
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss');
    render(<ConnectSheet />);

    act(() => {
      capturedOnChange?.(-1);
    });

    expect(dismissSpy).toHaveBeenCalled();
    dismissSpy.mockRestore();
  });

  it('triggers haptic feedback on connect', async () => {
    const mutate = jest.fn();
    mockUseServerConnect.mockReturnValue({
      mutate,
      reset: jest.fn(),
      isPending: false,
      error: null,
    });

    const { getByPlaceholderText, getByText } = render(<ConnectSheet />);
    fireEvent.changeText(
      getByPlaceholderText('https://your-server.example.com'),
      'https://valid.com',
    );
    fireEvent.press(getByText('Connect'));

    await waitFor(() => {
      expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });
  });
});
