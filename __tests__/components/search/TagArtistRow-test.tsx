jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: any) => <View testID="expo-image" {...props} /> };
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TagArtistRow } from '@/components/search/TagArtistRow';
import type { TagArtist } from '@/lib/types/search';

const baseArtist: TagArtist = {
  id: 'mbid-123',
  name: 'Radiohead',
  sortName: 'Radiohead',
  type: 'Artist',
  tags: ['rock', 'alternative', 'indie'],
  image: 'https://img.com/radiohead.jpg',
};

describe('TagArtistRow', () => {
  it('renders artist name', () => {
    const { getByText } = render(
      <TagArtistRow artist={baseArtist} isInLibrary={false} onPress={() => {}} />,
    );
    expect(getByText('Radiohead')).toBeTruthy();
  });

  it('renders up to 3 tags joined by dots', () => {
    const { getByText } = render(
      <TagArtistRow artist={baseArtist} isInLibrary={false} onPress={() => {}} />,
    );
    expect(getByText('rock · alternative · indie')).toBeTruthy();
  });

  it('shows "In Library" chip when isInLibrary is true', () => {
    const { getByText } = render(
      <TagArtistRow artist={baseArtist} isInLibrary={true} onPress={() => {}} />,
    );
    expect(getByText('In Library')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <TagArtistRow artist={baseArtist} isInLibrary={false} onPress={onPress} />,
    );
    fireEvent.press(getByText('Radiohead'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
